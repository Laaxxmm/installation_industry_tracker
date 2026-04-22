"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { BudgetLineInput } from "@/lib/validators";
import { toDecimal } from "@/lib/money";

export async function upsertBudgetLine(raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = BudgetLineInput.parse(raw);

  const total = toDecimal(input.quantity).times(toDecimal(input.unitCost));

  const data = {
    projectId: input.projectId,
    category: input.category,
    description: input.description,
    quantity: input.quantity,
    unitCost: input.unitCost,
    total: total.toString(),
  };

  if (input.id) {
    await db.budgetLine.update({ where: { id: input.id }, data });
  } else {
    await db.budgetLine.create({ data });
  }

  revalidatePath(`/projects/${input.projectId}/budget`);
  revalidatePath(`/projects/${input.projectId}`);
}

export async function deleteBudgetLine(id: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const line = await db.budgetLine.delete({ where: { id } });
  revalidatePath(`/projects/${line.projectId}/budget`);
  revalidatePath(`/projects/${line.projectId}`);
}
