"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { ClientInput } from "@/lib/validators";

export async function createClient(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = ClientInput.parse(raw);

  const client = await db.client.create({
    data: {
      name: input.name,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress ?? null,
      stateCode: input.stateCode,
      contactName: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "Client",
      entityId: client.id,
    },
  });

  revalidatePath("/clients");
  return client;
}

export async function updateClient(id: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = ClientInput.parse(raw);

  const client = await db.client.update({
    where: { id },
    data: {
      name: input.name,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress ?? null,
      stateCode: input.stateCode,
      contactName: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entity: "Client",
      entityId: id,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return client;
}

export async function archiveClient(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const client = await db.client.update({
    where: { id },
    data: { active: false },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ARCHIVE",
      entity: "Client",
      entityId: id,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return client;
}

export async function unarchiveClient(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const client = await db.client.update({
    where: { id },
    data: { active: true },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UNARCHIVE",
      entity: "Client",
      entityId: id,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return client;
}
