"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { OverheadInput, InvoiceInput } from "@/lib/validators";
import { istMonthStart } from "@/lib/time";

export async function upsertOverhead(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = OverheadInput.parse(raw);

  const periodMonth = istMonthStart(new Date(input.periodMonth));

  await db.overheadAllocation.upsert({
    where: {
      projectId_periodMonth: { projectId: input.projectId, periodMonth },
    },
    update: {
      amount: input.amount,
      note: input.note ?? null,
    },
    create: {
      projectId: input.projectId,
      periodMonth,
      amount: input.amount,
      note: input.note ?? null,
      createdById: session.user.id,
    },
  });
  revalidatePath("/overhead");
  revalidatePath(`/projects/${input.projectId}/pnl`);
  revalidatePath(`/projects/${input.projectId}`);
}

export async function createInvoice(raw: unknown) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = InvoiceInput.parse(raw);
  const invoice = await db.invoice.create({
    data: {
      projectId: input.projectId,
      invoiceNo: input.invoiceNo,
      amount: input.amount,
      issuedAt: new Date(input.issuedAt),
      note: input.note ?? null,
    },
  });
  revalidatePath(`/projects/${input.projectId}/pnl`);
  revalidatePath(`/projects/${input.projectId}/ledger`);
  return invoice;
}
