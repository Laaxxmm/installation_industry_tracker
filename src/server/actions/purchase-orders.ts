"use server";

import { revalidatePath } from "next/cache";
import {
  POStatus,
  Prisma,
  ProjectStageKey,
  ProjectStatus,
  QuoteEventKind,
  QuoteStatus,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { ConvertQuoteInput, POUpdateInput } from "@/lib/validators";

function formatProjectCode(year: number, seq: number): string {
  return `SAB-${year}-${String(seq).padStart(4, "0")}`;
}
function formatPONo(year: number, seq: number): string {
  return `SAB-WO-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextProjectCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const existing = await tx.projectCodeSequence.findUnique({ where: { year } });
  if (!existing) {
    await tx.projectCodeSequence.create({ data: { year, next: 2 } });
    return formatProjectCode(year, 1);
  }
  const claimed = existing.next;
  await tx.projectCodeSequence.update({
    where: { year },
    data: { next: { increment: 1 } },
  });
  return formatProjectCode(year, claimed);
}

async function nextPONo(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const existing = await tx.pONumberSequence.findUnique({ where: { year } });
  if (!existing) {
    await tx.pONumberSequence.create({ data: { year, next: 2 } });
    return formatPONo(year, 1);
  }
  const claimed = existing.next;
  await tx.pONumberSequence.update({
    where: { year },
    data: { next: { increment: 1 } },
  });
  return formatPONo(year, claimed);
}

const STAGE_KEYS: ProjectStageKey[] = [
  ProjectStageKey.SURVEY,
  ProjectStageKey.DELIVERY,
  ProjectStageKey.INSTALL,
  ProjectStageKey.COMMISSION,
  ProjectStageKey.HANDOVER,
];

/**
 * Convert an ACCEPTED quote into a live Project + auto-issued Work Order.
 *
 * In a single transaction:
 *  1) Create Project (new code, clientId, contractValue = quote.grandTotal).
 *  2) Seed 5 ProjectStage rows (PENDING).
 *  3) Copy each QuoteLine → BudgetLine (category, description, qty,
 *     unitCost = unitPrice × (1 − discount/100), total = lineSubtotal).
 *  4) Issue PurchaseOrder with snapshotJson (deep copy of quote + lines + client).
 *  5) Mark Quote CONVERTED and link projectId.
 *  6) Log QuoteEvent + AuditLog rows.
 */
export async function convertQuoteToProject(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = ConvertQuoteInput.parse(raw);

  const quote = await db.quote.findUnique({
    where: { id: input.quoteId },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== QuoteStatus.ACCEPTED) {
    throw new Error(
      `Quote must be ACCEPTED before conversion (current: ${quote.status})`,
    );
  }
  if (quote.projectId) throw new Error("Quote is already converted");

  const result = await db.$transaction(async (tx) => {
    const code = await nextProjectCode(tx);
    const poNo = await nextPONo(tx);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    // 1. Project
    const project = await tx.project.create({
      data: {
        code,
        name: input.projectName,
        clientName: quote.client.name, // keep legacy display
        clientId: quote.clientId,
        contractValue: quote.grandTotal,
        startDate,
        endDate,
        siteSupervisorId: input.siteSupervisorId ?? null,
        status: ProjectStatus.ACTIVE,
      },
    });

    // 2. Stages
    await tx.projectStage.createMany({
      data: STAGE_KEYS.map((k) => ({ projectId: project.id, stageKey: k })),
    });

    // 3. Budget seed from quote lines (ex-tax)
    await tx.budgetLine.createMany({
      data: quote.lines.map((l) => {
        // unitCost = unitPrice × (1 − discount/100), rounded to 2dp
        const disc = new Prisma.Decimal(l.discountPct);
        const factor = new Prisma.Decimal(1).minus(disc.div(100));
        const unitCost = new Prisma.Decimal(l.unitPrice)
          .times(factor)
          .toDecimalPlaces(2);
        return {
          projectId: project.id,
          category: l.category,
          description: l.description,
          quantity: l.quantity,
          unitCost,
          total: l.lineSubtotal, // qty × unitCost ≈ lineSubtotal (ex-tax)
        };
      }),
    });

    // 4. Work Order snapshot
    const snapshot = {
      quote: {
        id: quote.id,
        quoteNo: quote.quoteNo,
        title: quote.title,
        version: quote.version,
        placeOfSupplyStateCode: quote.placeOfSupplyStateCode,
        subtotal: quote.subtotal.toString(),
        taxTotal: quote.taxTotal.toString(),
        grandTotal: quote.grandTotal.toString(),
        notes: quote.notes,
        termsMd: quote.termsMd,
        createdAt: quote.createdAt.toISOString(),
      },
      client: {
        id: quote.client.id,
        name: quote.client.name,
        gstin: quote.client.gstin,
        pan: quote.client.pan,
        billingAddress: quote.client.billingAddress,
        shippingAddress: quote.client.shippingAddress,
        stateCode: quote.client.stateCode,
        contactName: quote.client.contactName,
        email: quote.client.email,
        phone: quote.client.phone,
      },
      lines: quote.lines.map((l) => ({
        sortOrder: l.sortOrder,
        category: l.category,
        description: l.description,
        hsnSac: l.hsnSac,
        quantity: l.quantity.toString(),
        unit: l.unit,
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        gstRatePct: l.gstRatePct.toString(),
        lineSubtotal: l.lineSubtotal.toString(),
        lineTax: l.lineTax.toString(),
        lineTotal: l.lineTotal.toString(),
      })),
    };

    const po = await tx.purchaseOrder.create({
      data: {
        poNo,
        projectId: project.id,
        quoteId: quote.id,
        status: POStatus.ISSUED,
        issuedAt: new Date(),
        plannedStart: startDate,
        plannedEnd: endDate,
        amount: quote.grandTotal,
        snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    // 5. Mark Quote CONVERTED
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.CONVERTED,
        projectId: project.id,
        convertedAt: new Date(),
      },
    });

    // 6. Event log
    await tx.quoteEvent.create({
      data: {
        quoteId: quote.id,
        kind: QuoteEventKind.ACCEPTED,
        note: `Converted to project ${project.code}; Work Order ${po.poNo} issued`,
        fromStatus: QuoteStatus.ACCEPTED,
        toStatus: QuoteStatus.CONVERTED,
        actorUserId: session.user.id,
      },
    });

    return { project, po };
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: `CONVERT:${result.project.code}:${result.po.poNo}`,
      entity: "Quote",
      entityId: quote.id,
    },
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quote.id}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${result.project.id}`);
  return result;
}

export async function signPO(poId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const po = await db.purchaseOrder.update({
    where: { id: poId },
    data: {
      signedAt: new Date(),
      signedByUserId: session.user.id,
    },
  });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SIGN",
      entity: "PurchaseOrder",
      entityId: poId,
    },
  });
  revalidatePath(`/projects/${po.projectId}/po`);
  return po;
}

export async function updatePO(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = POUpdateInput.parse(raw);
  const po = await db.purchaseOrder.update({
    where: { id: input.poId },
    data: {
      clientPoNumber: input.clientPoNumber ?? null,
      clientPoDate: input.clientPoDate ? new Date(input.clientPoDate) : null,
      plannedStart: input.plannedStart ? new Date(input.plannedStart) : undefined,
      plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : undefined,
    },
  });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entity: "PurchaseOrder",
      entityId: po.id,
    },
  });
  revalidatePath(`/projects/${po.projectId}/po`);
  return po;
}
