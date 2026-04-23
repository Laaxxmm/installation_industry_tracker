"use server";

import { revalidatePath } from "next/cache";
import { Role, Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";
import { db } from "@/server/db";
import { requireRole, canBookConsumptionFor } from "@/server/rbac";
import { MaterialInput, StockReceiptInput, StockIssueInput } from "@/lib/validators";
import { newMovingAverage } from "@/lib/inventory-cost";
import { toDecimal } from "@/lib/money";

// Replays every StockReceipt + StockIssue for `materialId` in chronological
// order (starting from openingQty @ openingAvgCost) and writes the resulting
// onHandQty and avgUnitCost back to Material. Issues don't change the moving
// average — they only reduce qty.
async function recomputeRunningBalance(
  tx: Prisma.TransactionClient,
  materialId: string,
) {
  const [material, receipts, issues] = await Promise.all([
    tx.material.findUnique({
      where: { id: materialId },
      select: { openingQty: true, openingAvgCost: true },
    }),
    tx.stockReceipt.findMany({
      where: { materialId },
      orderBy: { receivedAt: "asc" },
      select: { qty: true, unitCost: true, receivedAt: true },
    }),
    tx.stockIssue.findMany({
      where: { materialId },
      orderBy: { issuedAt: "asc" },
      select: { qty: true, issuedAt: true },
    }),
  ]);
  if (!material) throw new Error("Material not found");

  type Event =
    | { at: Date; kind: "receipt"; qty: Decimal; unitCost: Decimal }
    | { at: Date; kind: "issue"; qty: Decimal };
  const events: Event[] = [
    ...receipts.map<Event>((r) => ({
      at: r.receivedAt,
      kind: "receipt",
      qty: toDecimal(r.qty),
      unitCost: toDecimal(r.unitCost),
    })),
    ...issues.map<Event>((i) => ({
      at: i.issuedAt,
      kind: "issue",
      qty: toDecimal(i.qty),
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  let qty = toDecimal(material.openingQty);
  let avg = toDecimal(material.openingAvgCost);
  for (const e of events) {
    if (e.kind === "receipt") {
      const newQty = qty.plus(e.qty);
      if (newQty.gt(0)) {
        avg = qty.times(avg).plus(e.qty.times(e.unitCost)).div(newQty);
      }
      qty = newQty;
    } else {
      qty = qty.minus(e.qty);
    }
  }

  await tx.material.update({
    where: { id: materialId },
    data: {
      onHandQty: qty.toDecimalPlaces(3).toString(),
      avgUnitCost: avg.toDecimalPlaces(4).toString(),
    },
  });
}

export async function createMaterial(raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const input = MaterialInput.parse(raw);
  const material = await db.material.create({
    data: { sku: input.sku, name: input.name, unit: input.unit },
  });
  revalidatePath("/inventory");
  return material;
}

export async function updateMaterial(id: string, raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = MaterialInput.parse(raw);
  const material = await db.material.update({
    where: { id },
    data: { sku: input.sku, name: input.name, unit: input.unit },
  });
  revalidatePath("/inventory");
  return material;
}

export async function receiveStock(raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const input = StockReceiptInput.parse(raw);

  await db.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id: input.materialId } });
    if (!material) throw new Error("Material not found");

    const { qty, avgUnitCost } = newMovingAverage({
      onHandQty: material.onHandQty,
      avgUnitCost: material.avgUnitCost,
      receiptQty: input.qty,
      receiptUnitCost: input.unitCost,
    });

    await tx.stockReceipt.create({
      data: {
        materialId: input.materialId,
        qty: input.qty,
        unitCost: input.unitCost,
        supplier: input.supplier ?? null,
        receivedAt: new Date(input.receivedAt),
        note: input.note ?? null,
      },
    });

    await tx.material.update({
      where: { id: input.materialId },
      data: {
        onHandQty: qty.toString(),
        avgUnitCost: avgUnitCost.toDecimalPlaces(4).toString(),
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/receipts");
}

export async function updateStockReceipt(receiptId: string, raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = StockReceiptInput.parse(raw);

  await db.$transaction(async (tx) => {
    const existing = await tx.stockReceipt.findUnique({
      where: { id: receiptId },
      select: { id: true, materialId: true },
    });
    if (!existing) throw new Error("Receipt not found");

    await tx.stockReceipt.update({
      where: { id: receiptId },
      data: {
        materialId: input.materialId,
        qty: input.qty,
        unitCost: input.unitCost,
        supplier: input.supplier ?? null,
        receivedAt: new Date(input.receivedAt),
        note: input.note ?? null,
      },
    });

    await recomputeRunningBalance(tx, input.materialId);
    if (existing.materialId !== input.materialId) {
      await recomputeRunningBalance(tx, existing.materialId);
    }

    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: { onHandQty: true },
    });
    if (material && toDecimal(material.onHandQty).lt(0)) {
      throw new Error(
        "Edit would make on-hand quantity negative. Adjust issues first.",
      );
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/receipts");
}

export async function deleteStockReceipt(receiptId: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  await db.$transaction(async (tx) => {
    const receipt = await tx.stockReceipt.findUnique({
      where: { id: receiptId },
      select: { id: true, materialId: true },
    });
    if (!receipt) throw new Error("Receipt not found");

    await tx.stockReceipt.delete({ where: { id: receiptId } });
    await recomputeRunningBalance(tx, receipt.materialId);

    const material = await tx.material.findUnique({
      where: { id: receipt.materialId },
      select: { onHandQty: true },
    });
    if (material && toDecimal(material.onHandQty).lt(0)) {
      throw new Error(
        "Cannot delete — would make on-hand quantity negative. Adjust issues first.",
      );
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/receipts");
}

export async function deleteStockIssue(issueId: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  let projectId: string | null = null;
  await db.$transaction(async (tx) => {
    const issue = await tx.stockIssue.findUnique({
      where: { id: issueId },
      select: { id: true, materialId: true, projectId: true },
    });
    if (!issue) throw new Error("Issue not found");
    projectId = issue.projectId;

    await tx.stockIssue.delete({ where: { id: issueId } });
    await recomputeRunningBalance(tx, issue.materialId);
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/issues");
  if (projectId) {
    revalidatePath(`/projects/${projectId}/materials`);
    revalidatePath(`/projects/${projectId}`);
  }
}

export async function updateStockIssue(issueId: string, raw: unknown) {
  const input = StockIssueInput.parse(raw);
  await canBookConsumptionFor(input.projectId);

  let oldProjectId: string | null = null;
  await db.$transaction(async (tx) => {
    const existing = await tx.stockIssue.findUnique({
      where: { id: issueId },
      select: { id: true, materialId: true, projectId: true },
    });
    if (!existing) throw new Error("Issue not found");
    oldProjectId = existing.projectId;

    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: { avgUnitCost: true },
    });
    if (!material) throw new Error("Material not found");

    await tx.stockIssue.update({
      where: { id: issueId },
      data: {
        materialId: input.materialId,
        projectId: input.projectId,
        qty: input.qty,
        unitCostAtIssue: material.avgUnitCost.toString(),
        issuedAt: new Date(input.issuedAt),
        note: input.note ?? null,
      },
    });

    await recomputeRunningBalance(tx, input.materialId);
    if (existing.materialId !== input.materialId) {
      await recomputeRunningBalance(tx, existing.materialId);
    }

    const updatedMat = await tx.material.findUnique({
      where: { id: input.materialId },
      select: { onHandQty: true },
    });
    if (updatedMat && toDecimal(updatedMat.onHandQty).lt(0)) {
      throw new Error(
        "Edit would make on-hand quantity negative. Reduce the issue qty.",
      );
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/issues");
  revalidatePath(`/projects/${input.projectId}/materials`);
  revalidatePath(`/projects/${input.projectId}`);
  if (oldProjectId && oldProjectId !== input.projectId) {
    revalidatePath(`/projects/${oldProjectId}/materials`);
    revalidatePath(`/projects/${oldProjectId}`);
  }
}

export async function issueStock(raw: unknown) {
  const input = StockIssueInput.parse(raw);
  const session = await canBookConsumptionFor(input.projectId);

  await db.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id: input.materialId } });
    if (!material) throw new Error("Material not found");

    const issueQty = toDecimal(input.qty);
    const onHand = toDecimal(material.onHandQty);
    if (issueQty.gt(onHand)) {
      throw new Error(
        `Insufficient stock. On hand: ${onHand.toString()}, requested: ${issueQty.toString()}`,
      );
    }

    await tx.stockIssue.create({
      data: {
        materialId: input.materialId,
        projectId: input.projectId,
        qty: input.qty,
        unitCostAtIssue: material.avgUnitCost.toString(),
        issuedById: session.user.id,
        issuedAt: new Date(input.issuedAt),
        note: input.note ?? null,
      },
    });

    await tx.material.update({
      where: { id: input.materialId },
      data: { onHandQty: onHand.minus(issueQty).toString() },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/issues");
  revalidatePath(`/projects/${input.projectId}/materials`);
  revalidatePath(`/projects/${input.projectId}`);
}
