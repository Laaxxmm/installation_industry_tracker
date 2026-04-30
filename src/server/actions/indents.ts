"use server";

import { revalidatePath } from "next/cache";
import {
  MaterialIndentStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole, requireSession } from "@/server/rbac";
import {
  IssueIndentLineInput,
  MaterialIndentInput,
} from "@/lib/validators";
import { toDecimal } from "@/lib/money";
import { checkLineBudget } from "@/lib/indent-budget";

// ---------- Indent number sequence (FY-scoped) ----------

/**
 * Indian fiscal year runs April → March. For a given date, returns the
 * `(startYear, endYear)` pair as 2-digit shortcuts plus the storage year
 * (always the FY's start year, used as the IndentNumberSequence key).
 *
 * Example: 2026-04-30 → { storageYear: 2026, label: "26-27" }
 *          2026-02-15 → { storageYear: 2025, label: "25-26" }
 */
function getFyForDate(d: Date): { storageYear: number; label: string } {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based: Apr = 3
  const startYear = month >= 3 ? year : year - 1;
  const a = String(startYear % 100).padStart(2, "0");
  const b = String((startYear + 1) % 100).padStart(2, "0");
  return { storageYear: startYear, label: `${a}-${b}` };
}

async function nextIndentNumber(tx: Prisma.TransactionClient): Promise<string> {
  const fy = getFyForDate(new Date());
  const existing = await tx.indentNumberSequence.findUnique({
    where: { year: fy.storageYear },
  });
  let claimed: number;
  if (!existing) {
    await tx.indentNumberSequence.create({
      data: { year: fy.storageYear, next: 2 },
    });
    claimed = 1;
  } else {
    claimed = existing.next;
    await tx.indentNumberSequence.update({
      where: { year: fy.storageYear },
      data: { next: { increment: 1 } },
    });
  }
  return `IND-${fy.label}-${String(claimed).padStart(4, "0")}`;
}

// ---------- Budget aggregator ----------

/**
 * For one material on one project, sum:
 *   - budgeted qty (BudgetLine.quantity where materialId matches & category=MATERIAL)
 *   - already-issued qty (StockIssue.qty for that material+project)
 *   - pending indent qty (lines where indent is PENDING_APPROVAL/APPROVED/PARTIALLY_ISSUED,
 *     minus what's already been issued on those lines — i.e. open commitments)
 *
 * Pass `excludeIndentId` when re-checking lines on an indent already in flight
 * (e.g. on resubmit) so the indent doesn't double-count itself.
 */
async function aggregateBudgetState(
  tx: Prisma.TransactionClient,
  projectId: string,
  materialId: string,
  excludeIndentId?: string,
): Promise<{
  budgetedQty: string;
  alreadyIssuedQty: string;
  pendingIndentQty: string;
}> {
  const [budgetAgg, issueAgg, pendingLines] = await Promise.all([
    tx.budgetLine.aggregate({
      where: { projectId, materialId, category: "MATERIAL" },
      _sum: { quantity: true },
    }),
    tx.stockIssue.aggregate({
      where: { projectId, materialId },
      _sum: { qty: true },
    }),
    tx.materialIndentLine.findMany({
      where: {
        materialId,
        indent: {
          projectId,
          status: {
            in: [
              MaterialIndentStatus.PENDING_APPROVAL,
              MaterialIndentStatus.APPROVED,
              MaterialIndentStatus.PARTIALLY_ISSUED,
            ],
          },
          ...(excludeIndentId ? { id: { not: excludeIndentId } } : {}),
        },
      },
      select: { requestedQty: true, issuedQty: true },
    }),
  ]);

  // Open commitment per pending line = requested − already-issued.
  const pendingTotal = pendingLines.reduce((acc, line) => {
    const open = toDecimal(line.requestedQty).minus(toDecimal(line.issuedQty));
    return acc.plus(open.gt(0) ? open : 0);
  }, toDecimal(0));

  return {
    budgetedQty: (budgetAgg._sum.quantity ?? 0).toString(),
    alreadyIssuedQty: (issueAgg._sum.qty ?? 0).toString(),
    pendingIndentQty: pendingTotal.toString(),
  };
}

// ---------- Actions ----------

/** Create a DRAFT indent with its line items. PM (or higher) only. */
export async function createIndent(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = MaterialIndentInput.parse(raw);

  // Sanity-check materials exist + capture cost snapshots.
  const materialIds = Array.from(new Set(input.lines.map((l) => l.materialId)));
  const materials = await db.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, avgUnitCost: true, active: true, name: true },
  });
  if (materials.length !== materialIds.length) {
    throw new Error("One or more materials not found");
  }
  const inactive = materials.filter((m) => !m.active);
  if (inactive.length > 0) {
    throw new Error(
      `Cannot indent inactive materials: ${inactive.map((m) => m.name).join(", ")}`,
    );
  }
  const costByMatId = new Map(materials.map((m) => [m.id, m.avgUnitCost]));

  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, code: true },
  });
  if (!project) throw new Error("Project not found");

  const indent = await db.$transaction(async (tx) => {
    const indentNo = await nextIndentNumber(tx);
    return tx.materialIndent.create({
      data: {
        indentNo,
        projectId: input.projectId,
        requestedById: session.user.id,
        status: MaterialIndentStatus.DRAFT,
        notes: input.notes ?? null,
        lines: {
          create: input.lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: String(l.requestedQty),
            unitCostSnapshot: costByMatId.get(l.materialId)!.toString(),
            notes: l.notes ?? null,
          })),
        },
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "MaterialIndent",
      entityId: indent.id,
      action: "CREATE",
    },
  });

  revalidatePath("/indents");
  return { id: indent.id, indentNo: indent.indentNo };
}

/**
 * Submit a DRAFT indent. Runs the budget check on every line, sets
 * `isInBudget` + `reasonOutOfBudget` per line, and transitions the indent:
 *   - all lines in budget → APPROVED (auto)
 *   - any line out of budget → PENDING_APPROVAL (needs ADMIN)
 */
export async function submitIndent(indentId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  await db.$transaction(async (tx) => {
    const indent = await tx.materialIndent.findUnique({
      where: { id: indentId },
      include: { lines: { include: { material: { select: { name: true } } } } },
    });
    if (!indent) throw new Error("Indent not found");
    if (indent.status !== MaterialIndentStatus.DRAFT) {
      throw new Error(`Cannot submit indent in status ${indent.status}`);
    }
    if (indent.lines.length === 0) {
      throw new Error("Cannot submit empty indent");
    }

    let anyOutOfBudget = false;
    for (const line of indent.lines) {
      const agg = await aggregateBudgetState(
        tx,
        indent.projectId,
        line.materialId,
        indent.id,
      );
      const verdict = checkLineBudget({
        budgetedQty: agg.budgetedQty,
        alreadyIssuedQty: agg.alreadyIssuedQty,
        pendingIndentQty: agg.pendingIndentQty,
        requestedQty: line.requestedQty,
        materialName: line.material.name,
      });
      await tx.materialIndentLine.update({
        where: { id: line.id },
        data: {
          isInBudget: verdict.isInBudget,
          reasonOutOfBudget: verdict.isInBudget ? null : verdict.reason,
        },
      });
      if (!verdict.isInBudget) anyOutOfBudget = true;
    }

    const nextStatus = anyOutOfBudget
      ? MaterialIndentStatus.PENDING_APPROVAL
      : MaterialIndentStatus.APPROVED;

    await tx.materialIndent.update({
      where: { id: indentId },
      data: {
        status: nextStatus,
        needsApproval: anyOutOfBudget,
        submittedAt: new Date(),
        // Auto-approval bookkeeping when everything's in budget — credit the
        // requester + system timestamp so the audit trail is consistent.
        approvedById: anyOutOfBudget ? null : session.user.id,
        approvedAt: anyOutOfBudget ? null : new Date(),
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "MaterialIndent",
      entityId: indentId,
      action: "SUBMIT",
    },
  });

  revalidatePath("/indents");
  revalidatePath(`/indents/${indentId}`);
}

/** ADMIN approves a PENDING_APPROVAL indent. */
export async function approveIndent(indentId: string) {
  const session = await requireRole([Role.ADMIN]);

  await db.$transaction(async (tx) => {
    const indent = await tx.materialIndent.findUnique({
      where: { id: indentId },
      select: { status: true },
    });
    if (!indent) throw new Error("Indent not found");
    if (indent.status !== MaterialIndentStatus.PENDING_APPROVAL) {
      throw new Error(`Cannot approve indent in status ${indent.status}`);
    }
    await tx.materialIndent.update({
      where: { id: indentId },
      data: {
        status: MaterialIndentStatus.APPROVED,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "MaterialIndent",
      entityId: indentId,
      action: "APPROVE",
    },
  });

  revalidatePath("/indents");
  revalidatePath(`/indents/${indentId}`);
}

/** ADMIN rejects a PENDING_APPROVAL indent with a reason. */
export async function rejectIndent(indentId: string, reason: string) {
  const session = await requireRole([Role.ADMIN]);
  if (!reason || reason.trim().length === 0) {
    throw new Error("Rejection reason required");
  }
  if (reason.length > 1000) {
    throw new Error("Rejection reason too long");
  }

  await db.$transaction(async (tx) => {
    const indent = await tx.materialIndent.findUnique({
      where: { id: indentId },
      select: { status: true },
    });
    if (!indent) throw new Error("Indent not found");
    if (indent.status !== MaterialIndentStatus.PENDING_APPROVAL) {
      throw new Error(`Cannot reject indent in status ${indent.status}`);
    }
    await tx.materialIndent.update({
      where: { id: indentId },
      data: {
        status: MaterialIndentStatus.REJECTED,
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason: reason.trim(),
        closedAt: new Date(),
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "MaterialIndent",
      entityId: indentId,
      action: "REJECT",
    },
  });

  revalidatePath("/indents");
  revalidatePath(`/indents/${indentId}`);
}

/** Cancel: requester (only own DRAFT) or ADMIN (any non-terminal status). */
export async function cancelIndent(indentId: string) {
  const session = await requireSession();

  await db.$transaction(async (tx) => {
    const indent = await tx.materialIndent.findUnique({
      where: { id: indentId },
      select: { status: true, requestedById: true },
    });
    if (!indent) throw new Error("Indent not found");

    const terminal: MaterialIndentStatus[] = [
      MaterialIndentStatus.ISSUED,
      MaterialIndentStatus.REJECTED,
      MaterialIndentStatus.CANCELLED,
    ];
    if (terminal.includes(indent.status)) {
      throw new Error(`Cannot cancel indent in status ${indent.status}`);
    }

    const isAdmin = session.user.role === Role.ADMIN;
    const isOwnDraft =
      indent.requestedById === session.user.id &&
      indent.status === MaterialIndentStatus.DRAFT;
    if (!isAdmin && !isOwnDraft) {
      throw new Error("Not allowed to cancel this indent");
    }

    await tx.materialIndent.update({
      where: { id: indentId },
      data: {
        status: MaterialIndentStatus.CANCELLED,
        closedAt: new Date(),
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "MaterialIndent",
      entityId: indentId,
      action: "CANCEL",
    },
  });

  revalidatePath("/indents");
  revalidatePath(`/indents/${indentId}`);
}

/**
 * Issue stock against an indent line. Storekeeper (SUPERVISOR) or ADMIN.
 * Supports partial issuance: pass any qty 0 < qty ≤ remaining (requested −
 * already-issued). Updates Material.onHandQty atomically.
 *
 * Side effects in one transaction:
 *   - StockIssue row created (linked to indentLineId)
 *   - Material.onHandQty decremented
 *   - line.issuedQty updated
 *   - if every line on the indent is fully issued → MaterialIndent.status = ISSUED + closedAt
 *     else if any line has issuedQty > 0 → status = PARTIALLY_ISSUED
 */
export async function issueIndentLine(lineId: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.SUPERVISOR]);
  const input = IssueIndentLineInput.parse(raw);
  const qty = toDecimal(input.qtyToIssue);
  if (qty.lte(0)) throw new Error("Issue quantity must be positive");

  await db.$transaction(async (tx) => {
    const line = await tx.materialIndentLine.findUnique({
      where: { id: lineId },
      include: {
        indent: { select: { id: true, status: true, projectId: true } },
        material: { select: { id: true, onHandQty: true, avgUnitCost: true, name: true } },
      },
    });
    if (!line) throw new Error("Indent line not found");

    const issuableStatuses: MaterialIndentStatus[] = [
      MaterialIndentStatus.APPROVED,
      MaterialIndentStatus.PARTIALLY_ISSUED,
    ];
    if (!issuableStatuses.includes(line.indent.status)) {
      throw new Error(
        `Cannot issue against indent in status ${line.indent.status}`,
      );
    }

    const requested = toDecimal(line.requestedQty);
    const alreadyIssued = toDecimal(line.issuedQty);
    const remaining = requested.minus(alreadyIssued);
    if (qty.gt(remaining)) {
      throw new Error(
        `Requested issue ${qty.toString()} exceeds line remaining ${remaining.toString()}`,
      );
    }

    const onHand = toDecimal(line.material.onHandQty);
    if (qty.gt(onHand)) {
      throw new Error(
        `Insufficient stock: ${line.material.name} has ${onHand.toString()} on hand, requested ${qty.toString()}`,
      );
    }

    // 1) Create the StockIssue row, linked back to this indent line.
    await tx.stockIssue.create({
      data: {
        materialId: line.materialId,
        projectId: line.indent.projectId,
        qty: qty.toString(),
        unitCostAtIssue: line.material.avgUnitCost.toString(),
        issuedById: session.user.id,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : new Date(),
        note: input.note ?? null,
        indentLineId: line.id,
      },
    });

    // 2) Decrement Material.onHandQty.
    await tx.material.update({
      where: { id: line.materialId },
      data: { onHandQty: onHand.minus(qty).toString() },
    });

    // 3) Update line.issuedQty.
    const newIssuedQty = alreadyIssued.plus(qty);
    await tx.materialIndentLine.update({
      where: { id: line.id },
      data: { issuedQty: newIssuedQty.toString() },
    });

    // 4) Roll up indent status. Re-fetch all lines (post-update) to decide.
    const allLines = await tx.materialIndentLine.findMany({
      where: { indentId: line.indent.id },
      select: { requestedQty: true, issuedQty: true },
    });
    const allFullyIssued = allLines.every((l) =>
      toDecimal(l.issuedQty).gte(toDecimal(l.requestedQty)),
    );
    const anyIssued = allLines.some((l) => toDecimal(l.issuedQty).gt(0));

    if (allFullyIssued) {
      await tx.materialIndent.update({
        where: { id: line.indent.id },
        data: {
          status: MaterialIndentStatus.ISSUED,
          closedAt: new Date(),
        },
      });
    } else if (anyIssued) {
      await tx.materialIndent.update({
        where: { id: line.indent.id },
        data: { status: MaterialIndentStatus.PARTIALLY_ISSUED },
      });
    }
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "MaterialIndentLine",
      entityId: lineId,
      action: `ISSUE:${String(input.qtyToIssue)}`,
    },
  });

  revalidatePath("/indents");
  revalidatePath("/inventory");
}
