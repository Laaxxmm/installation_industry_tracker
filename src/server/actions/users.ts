"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { UserInput } from "@/lib/validators";

const UserEditInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]),
  employmentType: z.enum(["HOURLY", "SALARIED"]).nullable().optional(),
});

export async function createUser(raw: unknown) {
  await requireRole([Role.ADMIN]);
  const input = UserInput.parse(raw);

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      employmentType: input.employmentType ?? null,
      passwordHash,
    },
  });
  revalidatePath("/admin/users");
  return user;
}

export async function updateUser(userId: string, raw: unknown) {
  await requireRole([Role.ADMIN]);
  const input = UserEditInput.parse(raw);
  const user = await db.user.update({
    where: { id: userId },
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      employmentType: input.employmentType ?? null,
    },
  });
  revalidatePath("/admin/users");
  return user;
}

export async function setUserActive(userId: string, active: boolean) {
  await requireRole([Role.ADMIN]);
  await db.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/users");
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireRole([Role.ADMIN]);
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath("/admin/users");
}
