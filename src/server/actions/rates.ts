"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { RateCardInput } from "@/lib/validators";

export async function upsertRateCard(raw: unknown) {
  await requireRole([Role.ADMIN]);
  const input = RateCardInput.parse(raw);

  if (input.type === "HOURLY" && !input.hourlyRate) {
    throw new Error("Hourly rate required for HOURLY type");
  }
  if (input.type === "SALARIED" && !input.monthlySalary) {
    throw new Error("Monthly salary required for SALARIED type");
  }

  // Close any currently-open rate card for this user before inserting a new one.
  const effectiveFrom = new Date(input.effectiveFrom);
  await db.employeeRateCard.updateMany({
    where: { userId: input.userId, effectiveTo: null },
    data: { effectiveTo: effectiveFrom },
  });

  const card = await db.employeeRateCard.create({
    data: {
      userId: input.userId,
      type: input.type,
      hourlyRate: input.hourlyRate ?? null,
      monthlySalary: input.monthlySalary ?? null,
      effectiveFrom,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    },
  });

  revalidatePath("/admin/rates");
  return card;
}
