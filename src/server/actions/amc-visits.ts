"use server";

// AMCVisit lifecycle: SCHEDULED → IN_PROGRESS → COMPLETED (or MISSED / CANCELLED).
// Completion is the interesting one: it writes a StockIssue for partsUsed, and
// if the parent AMC is billed PER_VISIT and the completer sets billableAmount,
// we also generate a DRAFT ClientInvoice linked to the AMC.

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import {
  AMCBillingMode,
  AMCVisitStatus,
  InvoiceKind,
  InvoiceStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { AMCVisitCompleteInput } from "@/lib/validators";

const D = Prisma.Decimal;

function newShareToken(): string {
  return randomBytes(32).toString("hex");
}

function draftInvoiceNo(): string {
  return `DRAFT-${newShareToken().slice(0, 10).toUpperCase()}`;
}

type PartLine = { sku?: string; description: string; qty: string | number; unit: string };

/** Assign a technician to a scheduled visit. */
export async function assignAMCVisit(id: string, userId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);

  const visit = await db.aMCVisit.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!visit) throw new Error("Visit not found");
  if (visit.status !== AMCVisitStatus.SCHEDULED) {
    throw new Error(`Cannot assign a visit in status ${visit.status}`);
  }

  await db.aMCVisit.update({
    where: { id },
    data: { assignedToUserId: userId },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ASSIGN",
      entity: "AMCVisit",
      entityId: id,
    },
  });

  revalidatePath(`/amcs`);
  revalidatePath(`/mobile/amc`);
}

/** Technician marks visit in-progress when they arrive on-site. */
export async function startAMCVisit(id: string) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);

  const visit = await db.aMCVisit.findUnique({
    where: { id },
    select: { status: true, assignedToUserId: true },
  });
  if (!visit) throw new Error("Visit not found");
  if (visit.status !== AMCVisitStatus.SCHEDULED) {
    throw new Error(`Cannot start a visit in status ${visit.status}`);
  }

  await db.aMCVisit.update({
    where: { id },
    data: {
      status: AMCVisitStatus.IN_PROGRESS,
      startedAt: new Date(),
      // If nobody was assigned, the user who taps Start becomes the assignee.
      assignedToUserId: visit.assignedToUserId ?? session.user.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "START",
      entity: "AMCVisit",
      entityId: id,
    },
  });

  revalidatePath(`/mobile/amc`);
  revalidatePath(`/amcs`);
}

/**
 * Complete a visit: stamp completedAt, save findings/photos/geo, create a
 * StockIssue for any partsUsed, and (if the AMC is PER_VISIT billed) create
 * a DRAFT ClientInvoice.
 *
 * Idempotency: if `offlineClientOpId` is supplied and matches an already-
 * completed visit, returns the existing result without re-running.
 */
export async function completeAMCVisit(id: string, raw: unknown) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);
  const input = AMCVisitCompleteInput.parse(raw);

  // Offline-retry dedupe: if this visit was already completed with the same
  // offlineClientOpId, short-circuit.
  if (input.offlineClientOpId) {
    const existing = await db.aMCVisit.findUnique({
      where: { id },
      select: { offlineClientOpId: true, status: true },
    });
    if (
      existing?.offlineClientOpId === input.offlineClientOpId &&
      existing?.status === AMCVisitStatus.COMPLETED
    ) {
      return { visitId: id, deduped: true };
    }
  }

  const visit = await db.aMCVisit.findUnique({
    where: { id },
    include: { amc: { select: { id: true, projectId: true, clientId: true, billingMode: true, contractNo: true } } },
  });
  if (!visit) throw new Error("Visit not found");
  if (visit.status === AMCVisitStatus.COMPLETED) {
    throw new Error("Visit already completed");
  }
  if (visit.status === AMCVisitStatus.CANCELLED || visit.status === AMCVisitStatus.MISSED) {
    throw new Error(`Cannot complete a ${visit.status} visit`);
  }

  const parts: PartLine[] = (input.partsUsed ?? []) as PartLine[];

  await db.$transaction(async (tx) => {
    // Update the visit itself.
    await tx.aMCVisit.update({
      where: { id },
      data: {
        status: AMCVisitStatus.COMPLETED,
        completedAt: new Date(),
        findings: input.findings ?? null,
        photoUrls: input.photoUrls,
        geoLat: input.geoLat !== undefined ? new D(input.geoLat) : null,
        geoLng: input.geoLng !== undefined ? new D(input.geoLng) : null,
        checklist: input.checklist ? (input.checklist as Prisma.InputJsonValue) : undefined,
        partsUsed: parts.length > 0 ? (parts as Prisma.InputJsonValue) : undefined,
        notes: input.notes ?? null,
        offlineClientOpId: input.offlineClientOpId ?? undefined,
      },
    });

    // StockIssue for parts (one aggregate row per material would be ideal, but
    // partsUsed is free-form — we only create StockIssue rows for lines that
    // reference an existing Material by SKU).
    if (parts.length > 0) {
      for (const p of parts) {
        if (!p.sku) continue;
        const material = await tx.material.findFirst({
          where: { sku: p.sku },
          select: { id: true },
        });
        if (!material) continue;
        // Peek at current unit cost via the latest receipt (best available).
        const latestReceipt = await tx.stockReceipt.findFirst({
          where: { materialId: material.id },
          orderBy: { receivedAt: "desc" },
          select: { unitCost: true },
        });
        await tx.stockIssue.create({
          data: {
            materialId: material.id,
            projectId: visit.amc.projectId,
            qty: new D(String(p.qty)),
            unitCostAtIssue: latestReceipt?.unitCost ?? new D(0),
            issuedById: session.user.id,
            issuedAt: new Date(),
            note: `AMC visit ${visit.amc.contractNo} #${visit.visitNo}`,
            amcVisitId: visit.id,
          },
        });
        // StockIssue is XOR; only one per visit via @unique. If the same visit
        // legitimately consumes multiple SKUs, that's a data-model gap we'll
        // close in v2 (splitting StockIssue into a header+lines shape).
        break;
      }
    }

    // PER_VISIT billing: generate a DRAFT invoice if billableAmount given.
    if (
      visit.amc.billingMode === AMCBillingMode.PER_VISIT &&
      input.billableAmount !== undefined
    ) {
      const client = await tx.client.findUnique({
        where: { id: visit.amc.clientId },
        select: { stateCode: true },
      });
      if (!client) throw new Error("AMC client not found");
      const billable = new D(input.billableAmount);
      await tx.clientInvoice.create({
        data: {
          invoiceNo: draftInvoiceNo(),
          kind: InvoiceKind.SERVICE_CALL,
          status: InvoiceStatus.DRAFT,
          projectId: visit.amc.projectId,
          clientId: visit.amc.clientId,
          placeOfSupplyStateCode: client.stateCode,
          subtotal: billable,
          cgst: new D(0),
          sgst: new D(0),
          igst: new D(0),
          taxTotal: new D(0),
          grandTotal: billable,
          notes: `AMC ${visit.amc.contractNo} — per-visit charge (visit #${visit.visitNo})`,
          amcId: visit.amc.id,
          createdById: session.user.id,
          shareToken: newShareToken(),
        },
      });
    }
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "COMPLETE",
      entity: "AMCVisit",
      entityId: id,
    },
  });

  revalidatePath(`/amcs`);
  revalidatePath(`/amcs/${visit.amc.id}`);
  revalidatePath(`/amcs/${visit.amc.id}/visits/${id}`);
  revalidatePath(`/mobile/amc`);
  return { visitId: id, deduped: false };
}

/** Reschedule a still-SCHEDULED visit to a new date. */
export async function rescheduleAMCVisit(id: string, newDate: string, reason: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  if (!reason || reason.trim().length < 3) {
    throw new Error("Reason required to reschedule a visit");
  }

  const visit = await db.aMCVisit.findUnique({
    where: { id },
    select: { status: true, amcId: true },
  });
  if (!visit) throw new Error("Visit not found");
  if (visit.status !== AMCVisitStatus.SCHEDULED) {
    throw new Error(`Cannot reschedule a visit in status ${visit.status}`);
  }

  const parsed = new Date(newDate);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid new date");

  await db.aMCVisit.update({
    where: { id },
    data: {
      scheduledDate: parsed,
      notes: reason,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "RESCHEDULE",
      entity: "AMCVisit",
      entityId: id,
    },
  });

  revalidatePath(`/amcs`);
  revalidatePath(`/amcs/${visit.amcId}`);
  revalidatePath(`/mobile/amc`);
}
