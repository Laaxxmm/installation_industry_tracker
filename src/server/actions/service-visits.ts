"use server";

// Log a technician visit against a ServiceIssue. First-visit-ever stamps
// firstResponseAt so the SLA response clock closes out. Parts used cascade
// into a StockIssue row for inventory depletion.

import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { ServiceVisitLogInput } from "@/lib/validators";

const D = Prisma.Decimal;

type PartLine = { sku?: string; description: string; qty: string | number; unit: string };

/**
 * Append a ServiceVisit. First time firstResponseAt is null, we stamp it
 * to "now" so the response-SLA clock stops.
 *
 * Idempotency: if `offlineClientOpId` is supplied and matches an existing
 * ServiceVisit, the existing row is returned unchanged.
 */
export async function logServiceVisit(serviceIssueId: string, raw: unknown) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);
  const input = ServiceVisitLogInput.parse(raw);

  // Offline-retry dedupe.
  if (input.offlineClientOpId) {
    const existing = await db.serviceVisit.findUnique({
      where: { offlineClientOpId: input.offlineClientOpId },
      select: { id: true, serviceIssueId: true },
    });
    if (existing && existing.serviceIssueId === serviceIssueId) {
      return { visitId: existing.id, deduped: true };
    }
  }

  const issue = await db.serviceIssue.findUnique({
    where: { id: serviceIssueId },
    select: { id: true, projectId: true, firstResponseAt: true },
  });
  if (!issue) throw new Error("Ticket not found");

  const parts: PartLine[] = (input.partsUsed ?? []) as PartLine[];

  const visit = await db.$transaction(async (tx) => {
    const created = await tx.serviceVisit.create({
      data: {
        serviceIssueId,
        assignedToUserId: session.user.id,
        scheduledAt: null,
        arrivedAt: input.arrivedAt ? new Date(input.arrivedAt) : new Date(),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        findings: input.findings ?? null,
        workPerformed: input.workPerformed ?? null,
        partsUsed: parts.length > 0 ? (parts as Prisma.InputJsonValue) : undefined,
        photoUrls: input.photoUrls,
        geoLat: input.geoLat !== undefined ? new D(input.geoLat) : null,
        geoLng: input.geoLng !== undefined ? new D(input.geoLng) : null,
        signatureUrl: input.signatureUrl ?? null,
        offlineClientOpId: input.offlineClientOpId ?? null,
      },
    });

    // StockIssue for the first parts line that maps to a known Material (same
    // single-line caveat as amc-visits.ts — revisit in v2).
    if (parts.length > 0) {
      for (const p of parts) {
        if (!p.sku) continue;
        const material = await tx.material.findFirst({
          where: { sku: p.sku },
          select: { id: true },
        });
        if (!material) continue;
        const latestReceipt = await tx.stockReceipt.findFirst({
          where: { materialId: material.id },
          orderBy: { receivedAt: "desc" },
          select: { unitCost: true },
        });
        await tx.stockIssue.create({
          data: {
            materialId: material.id,
            projectId: issue.projectId,
            qty: new D(String(p.qty)),
            unitCostAtIssue: latestReceipt?.unitCost ?? new D(0),
            issuedById: session.user.id,
            issuedAt: new Date(),
            note: `Service visit — ticket ${serviceIssueId}`,
            serviceVisitId: created.id,
          },
        });
        break;
      }
    }

    // If this is the first visit, stamp firstResponseAt on the ticket.
    if (!issue.firstResponseAt) {
      await tx.serviceIssue.update({
        where: { id: serviceIssueId },
        data: { firstResponseAt: new Date() },
      });
    }

    return created;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LOG_VISIT",
      entity: "ServiceVisit",
      entityId: visit.id,
    },
  });

  revalidatePath(`/service/issues/${serviceIssueId}`);
  revalidatePath(`/mobile/service/${serviceIssueId}`);
  return { visitId: visit.id, deduped: false };
}
