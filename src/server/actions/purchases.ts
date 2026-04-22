"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { canBookConsumptionFor, requireRole } from "@/server/rbac";
import { DirectPurchaseInput } from "@/lib/validators";
import { toDecimal } from "@/lib/money";

export async function createDirectPurchase(raw: unknown) {
  const input = DirectPurchaseInput.parse(raw);
  await canBookConsumptionFor(input.projectId);

  const total = toDecimal(input.qty).times(toDecimal(input.unitCost));
  await db.directPurchase.create({
    data: {
      projectId: input.projectId,
      description: input.description,
      qty: input.qty,
      unitCost: input.unitCost,
      total: total.toString(),
      supplier: input.supplier ?? null,
      invoiceRef: input.invoiceRef ?? null,
      purchasedAt: new Date(input.purchasedAt),
      category: input.category,
    },
  });
  revalidatePath(`/projects/${input.projectId}/materials`);
  revalidatePath(`/projects/${input.projectId}`);
}

export async function updateDirectPurchase(id: string, raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = DirectPurchaseInput.parse(raw);
  await canBookConsumptionFor(input.projectId);

  const existing = await db.directPurchase.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!existing) throw new Error("Purchase not found");

  const total = toDecimal(input.qty).times(toDecimal(input.unitCost));
  await db.directPurchase.update({
    where: { id },
    data: {
      projectId: input.projectId,
      description: input.description,
      qty: input.qty,
      unitCost: input.unitCost,
      total: total.toString(),
      supplier: input.supplier ?? null,
      invoiceRef: input.invoiceRef ?? null,
      purchasedAt: new Date(input.purchasedAt),
      category: input.category,
    },
  });
  revalidatePath(`/projects/${input.projectId}/materials`);
  revalidatePath(`/projects/${input.projectId}`);
  if (existing.projectId !== input.projectId) {
    revalidatePath(`/projects/${existing.projectId}/materials`);
    revalidatePath(`/projects/${existing.projectId}`);
  }
}

export async function deleteDirectPurchase(id: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const existing = await db.directPurchase.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!existing) throw new Error("Purchase not found");
  await db.directPurchase.delete({ where: { id } });
  revalidatePath(`/projects/${existing.projectId}/materials`);
  revalidatePath(`/projects/${existing.projectId}`);
}
