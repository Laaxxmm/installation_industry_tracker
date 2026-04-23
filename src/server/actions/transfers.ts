"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { canBookConsumptionFor, requireRole } from "@/server/rbac";
import { MaterialTransferInput } from "@/lib/validators";
import { toDecimal } from "@/lib/money";

/**
 * Inter-project / inter-site material transfer.
 *
 * Model: material is moved from one project's on-site inventory to another's
 * without a round-trip through central stock. The moving-average on the
 * Material record is NOT touched (that tracks central stock); we snapshot the
 * Material's current avgUnitCost as `unitCostAtTransfer`.
 *
 * P&L effect: the sender project credits (qty * unitCostAtTransfer) against
 * its material cost, and the receiver debits the same amount. Portfolio-wide
 * this is net zero.
 *
 * RBAC: caller must be authorized to book consumption for the SOURCE project
 * (the one parting with the material). Admins/managers always pass; a
 * supervisor must be assigned to the source project.
 */
export async function createMaterialTransfer(raw: unknown) {
  const input = MaterialTransferInput.parse(raw);
  const session = await canBookConsumptionFor(input.fromProjectId);

  await db.$transaction(async (tx) => {
    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: { id: true, avgUnitCost: true },
    });
    if (!material) throw new Error("Material not found");

    const [fromProject, toProject] = await Promise.all([
      tx.project.findUnique({ where: { id: input.fromProjectId }, select: { id: true } }),
      tx.project.findUnique({ where: { id: input.toProjectId }, select: { id: true } }),
    ]);
    if (!fromProject) throw new Error("Source project not found");
    if (!toProject) throw new Error("Destination project not found");

    const qty = toDecimal(input.qty);
    if (qty.lte(0)) throw new Error("Transfer quantity must be positive");

    await tx.materialTransfer.create({
      data: {
        materialId: input.materialId,
        fromProjectId: input.fromProjectId,
        toProjectId: input.toProjectId,
        qty: qty.toString(),
        unitCostAtTransfer: material.avgUnitCost.toString(),
        transferredById: session.user.id,
        transferredAt: new Date(input.transferredAt),
        note: input.note ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "MaterialTransfer",
        entityId: `${input.fromProjectId}->${input.toProjectId}:${input.materialId}`,
      },
    });
  });

  revalidatePath(`/projects/${input.fromProjectId}/materials`);
  revalidatePath(`/projects/${input.toProjectId}/materials`);
  revalidatePath(`/projects/${input.fromProjectId}/pnl`);
  revalidatePath(`/projects/${input.toProjectId}/pnl`);
  revalidatePath(`/projects/${input.fromProjectId}/ledger`);
  revalidatePath(`/projects/${input.toProjectId}/ledger`);
}

export async function updateMaterialTransfer(id: string, raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = MaterialTransferInput.parse(raw);

  const existing = await db.materialTransfer.findUnique({
    where: { id },
    select: {
      fromProjectId: true,
      toProjectId: true,
      unitCostAtTransfer: true,
      materialId: true,
    },
  });
  if (!existing) throw new Error("Transfer not found");

  const qty = toDecimal(input.qty);
  if (qty.lte(0)) throw new Error("Transfer quantity must be positive");

  // Keep the original cost snapshot unless material changed — switching
  // material requires re-snapshotting from that material's current avg.
  let unitCost = existing.unitCostAtTransfer.toString();
  if (existing.materialId !== input.materialId) {
    const material = await db.material.findUnique({
      where: { id: input.materialId },
      select: { avgUnitCost: true },
    });
    if (!material) throw new Error("Material not found");
    unitCost = material.avgUnitCost.toString();
  }

  await db.materialTransfer.update({
    where: { id },
    data: {
      materialId: input.materialId,
      fromProjectId: input.fromProjectId,
      toProjectId: input.toProjectId,
      qty: qty.toString(),
      unitCostAtTransfer: unitCost,
      transferredAt: new Date(input.transferredAt),
      note: input.note ?? null,
    },
  });

  const touched = new Set([
    existing.fromProjectId,
    existing.toProjectId,
    input.fromProjectId,
    input.toProjectId,
  ]);
  for (const pid of touched) {
    revalidatePath(`/projects/${pid}/materials`);
    revalidatePath(`/projects/${pid}/pnl`);
    revalidatePath(`/projects/${pid}/ledger`);
  }
}

export async function deleteMaterialTransfer(id: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const existing = await db.materialTransfer.findUnique({
    where: { id },
    select: { fromProjectId: true, toProjectId: true },
  });
  if (!existing) throw new Error("Transfer not found");
  await db.materialTransfer.delete({ where: { id } });
  for (const pid of [existing.fromProjectId, existing.toProjectId]) {
    revalidatePath(`/projects/${pid}/materials`);
    revalidatePath(`/projects/${pid}/pnl`);
    revalidatePath(`/projects/${pid}/ledger`);
  }
}
