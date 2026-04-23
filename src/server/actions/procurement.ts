"use server";

import { revalidatePath } from "next/cache";
import { Prisma, Role, VendorPOStatus, GRNStatus, VendorBillStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import {
  VendorInput,
  VendorPOCreateInput,
  GRNCreateInput,
  VendorBillCreateInput,
} from "@/lib/validators";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Approval tiers mirror the Claude Design prototype:
//   up to ₹1,00,000  → auto-approve
//   ₹1,00,001–₹10,00,000 → PM approval
//   above ₹10,00,000 → director approval
function approvalTierFor(total: Decimal | number): "auto" | "pm" | "director" {
  const n = typeof total === "number" ? new D(total) : total;
  if (n.lte(1_00_000)) return "auto";
  if (n.lte(10_00_000)) return "pm";
  return "director";
}

// Indian financial year starts in April — share this convention with client
// invoice + project code sequences already defined in schema.
function fyFor(date = new Date()): number {
  const m = date.getMonth(); // 0-indexed
  return m >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

// ---------- Sequence helpers (atomic next-number allocation) ----------

async function nextVendorCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = fyFor();
  const row = await tx.vendorCodeSequence.upsert({
    where: { year },
    update: { next: { increment: 1 } },
    create: { year, next: 2 },
  });
  const seq = row.next - 1;
  return `V-${pad(seq + 1040, 4)}`; // prototype starts at V-1041
}

async function nextVendorPONo(tx: Prisma.TransactionClient): Promise<string> {
  const year = fyFor();
  const row = await tx.vendorPONumberSequence.upsert({
    where: { year },
    update: { next: { increment: 1 } },
    create: { year, next: 2 },
  });
  const seq = row.next - 1;
  return `PO-${pad(seq + 1040, 4)}`;
}

async function nextGRNNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = fyFor();
  const row = await tx.gRNNumberSequence.upsert({
    where: { year },
    update: { next: { increment: 1 } },
    create: { year, next: 2 },
  });
  return `GRN-${pad(row.next - 1, 4)}`;
}

async function nextVendorBillNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = fyFor();
  const row = await tx.vendorBillNumberSequence.upsert({
    where: { year },
    update: { next: { increment: 1 } },
    create: { year, next: 2 },
  });
  return `VB-${pad(row.next - 1, 4)}`;
}

// ---------- Vendors ----------

export async function createVendor(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = VendorInput.parse(raw);

  const vendor = await db.$transaction(async (tx) => {
    const code = await nextVendorCode(tx);
    return tx.vendor.create({
      data: {
        code,
        name: input.name,
        gstin: input.gstin ?? null,
        pan: input.pan ?? null,
        stateCode: input.stateCode,
        category: input.category,
        msme: input.msme,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        paymentTerms: input.paymentTerms,
        creditLimit: new D(input.creditLimit),
        notes: input.notes ?? null,
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "Vendor",
      entityId: vendor.id,
    },
  });

  revalidatePath("/procurement/vendors");
  return vendor;
}

export async function updateVendor(id: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = VendorInput.parse(raw);

  const vendor = await db.vendor.update({
    where: { id },
    data: {
      name: input.name,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      stateCode: input.stateCode,
      category: input.category,
      msme: input.msme,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      paymentTerms: input.paymentTerms,
      creditLimit: new D(input.creditLimit),
      notes: input.notes ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entity: "Vendor",
      entityId: id,
    },
  });

  revalidatePath("/procurement/vendors");
  revalidatePath(`/procurement/vendors/${id}`);
  return vendor;
}

export async function archiveVendor(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const vendor = await db.vendor.update({ where: { id }, data: { active: false } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ARCHIVE",
      entity: "Vendor",
      entityId: id,
    },
  });

  revalidatePath("/procurement/vendors");
  return vendor;
}

// ---------- Vendor POs ----------

export async function createVendorPO(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = VendorPOCreateInput.parse(raw);

  // Compute line totals + PO totals up front so one DB round-trip writes the
  // entire PO graph. Line math: qty*unitPrice = subtotal, plus gst%.
  const lineCalcs = input.lines.map((l, idx) => {
    const qty = new D(l.quantity);
    const price = new D(l.unitPrice);
    const gstPct = new D(l.gstRatePct);
    const lineSubtotal = qty.mul(price);
    const lineTax = lineSubtotal.mul(gstPct).div(100);
    const lineTotal = lineSubtotal.plus(lineTax);
    return { ...l, idx, qty, price, gstPct, lineSubtotal, lineTax, lineTotal };
  });

  const subtotal = lineCalcs.reduce((acc, l) => acc.plus(l.lineSubtotal), new D(0));
  const taxTotal = lineCalcs.reduce((acc, l) => acc.plus(l.lineTax), new D(0));
  const grandTotal = subtotal.plus(taxTotal);
  const tier = approvalTierFor(grandTotal);
  const status: VendorPOStatus = tier === "auto" ? "APPROVED" : "PENDING_APPROVAL";

  const po = await db.$transaction(async (tx) => {
    const poNo = await nextVendorPONo(tx);
    return tx.vendorPO.create({
      data: {
        poNo,
        vendorId: input.vendorId,
        projectId: input.projectId ?? null,
        status,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        subtotal,
        taxTotal,
        grandTotal,
        approvalTier: tier,
        approvedByUserId: tier === "auto" ? session.user.id : null,
        approvedAt: tier === "auto" ? new Date() : null,
        notes: input.notes ?? null,
        lines: {
          create: lineCalcs.map((l) => ({
            sortOrder: l.idx,
            sku: l.sku,
            description: l.description,
            unit: l.unit,
            quantity: l.qty,
            unitPrice: l.price,
            gstRatePct: l.gstPct,
            lineSubtotal: l.lineSubtotal,
            lineTax: l.lineTax,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "VendorPO",
      entityId: po.id,
    },
  });

  revalidatePath("/procurement/purchase-orders");
  return po;
}

export async function approveVendorPO(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const po = await db.vendorPO.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedByUserId: session.user.id,
      approvedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "APPROVE",
      entity: "VendorPO",
      entityId: id,
    },
  });

  revalidatePath("/procurement/purchase-orders");
  revalidatePath(`/procurement/purchase-orders/${id}`);
  return po;
}

export async function sendVendorPO(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const po = await db.vendorPO.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SEND",
      entity: "VendorPO",
      entityId: id,
    },
  });

  revalidatePath("/procurement/purchase-orders");
  revalidatePath(`/procurement/purchase-orders/${id}`);
  return po;
}

export async function cancelVendorPO(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const po = await db.vendorPO.update({
    where: { id },
    data: { status: "CANCELLED", closedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CANCEL",
      entity: "VendorPO",
      entityId: id,
    },
  });

  revalidatePath("/procurement/purchase-orders");
  revalidatePath(`/procurement/purchase-orders/${id}`);
  return po;
}

// ---------- GRNs ----------

export async function createGRN(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const input = GRNCreateInput.parse(raw);

  // Hydrate the PO lines so we know the ordered quantities and can transition
  // the parent PO to PARTIALLY_RECEIVED / RECEIVED.
  const po = await db.vendorPO.findUniqueOrThrow({
    where: { id: input.poId },
    include: { lines: true },
  });

  const grn = await db.$transaction(async (tx) => {
    const grnNo = await nextGRNNo(tx);

    // Build GRN line rows + track which PO lines need receivedQty updates.
    const grnLineRows: Prisma.GRNLineCreateManyGrnInput[] = [];
    const poLineUpdates: { id: string; receivedQty: Decimal }[] = [];

    let allShort = true;
    let anyRejected = false;

    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i]!;
      const poLine = po.lines.find((l) => l.id === line.poLineId);
      if (!poLine) continue;
      const accepted = new D(line.acceptedQty);
      const rejected = new D(line.rejectedQty);
      const newReceived = poLine.receivedQty.plus(accepted);

      if (rejected.gt(0)) anyRejected = true;
      if (newReceived.gte(poLine.quantity)) allShort = false;

      grnLineRows.push({
        poLineId: poLine.id,
        sortOrder: i,
        orderedQty: poLine.quantity,
        acceptedQty: accepted,
        rejectedQty: rejected,
        reason: line.reason ?? null,
      });

      poLineUpdates.push({ id: poLine.id, receivedQty: newReceived });
    }

    // Pick a GRN status: accepted / partially-accepted / rejected.
    const grnStatus: GRNStatus = anyRejected
      ? allShort
        ? "REJECTED"
        : "PARTIALLY_ACCEPTED"
      : "ACCEPTED";

    const created = await tx.gRN.create({
      data: {
        grnNo,
        poId: po.id,
        status: grnStatus,
        receivedAt: new Date(input.receivedAt),
        receivedByUserId: session.user.id,
        notes: input.notes ?? null,
        lines: { create: grnLineRows },
      },
    });

    for (const u of poLineUpdates) {
      await tx.vendorPOLine.update({
        where: { id: u.id },
        data: { receivedQty: u.receivedQty },
      });
    }

    // Pull back the PO lines in-transaction to decide PO status.
    const refreshed = await tx.vendorPO.findUniqueOrThrow({
      where: { id: po.id },
      include: { lines: true },
    });

    const fullyReceived = refreshed.lines.every((l) =>
      new D(l.receivedQty).gte(l.quantity),
    );
    const anyReceived = refreshed.lines.some((l) => new D(l.receivedQty).gt(0));

    let nextStatus: VendorPOStatus = refreshed.status;
    if (fullyReceived) nextStatus = "RECEIVED";
    else if (anyReceived) nextStatus = "PARTIALLY_RECEIVED";

    if (nextStatus !== refreshed.status) {
      await tx.vendorPO.update({
        where: { id: po.id },
        data: {
          status: nextStatus,
          closedAt: nextStatus === "RECEIVED" ? new Date() : null,
        },
      });
    }

    return created;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "GRN",
      entityId: grn.id,
    },
  });

  revalidatePath("/procurement/grns");
  revalidatePath("/procurement/purchase-orders");
  revalidatePath(`/procurement/purchase-orders/${po.id}`);
  return grn;
}

// ---------- Vendor bills ----------

export async function createVendorBill(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = VendorBillCreateInput.parse(raw);

  // Compute line + bill totals.
  const lineCalcs = input.lines.map((l, idx) => {
    const qty = new D(l.quantity);
    const price = new D(l.unitPrice);
    const gstPct = new D(l.gstRatePct);
    const lineSubtotal = qty.mul(price);
    const lineTax = lineSubtotal.mul(gstPct).div(100);
    const lineTotal = lineSubtotal.plus(lineTax);
    return { ...l, idx, qty, price, gstPct, lineSubtotal, lineTax, lineTotal };
  });
  const subtotal = lineCalcs.reduce((acc, l) => acc.plus(l.lineSubtotal), new D(0));
  const taxTotal = lineCalcs.reduce((acc, l) => acc.plus(l.lineTax), new D(0));
  const grandTotal = subtotal.plus(taxTotal);

  // Initial status: if linked to a PO, it enters PENDING_MATCH (waiting on the
  // three-way match to clear); otherwise it's a direct bill and goes DRAFT.
  const status: VendorBillStatus = input.poId ? "PENDING_MATCH" : "DRAFT";

  const bill = await db.$transaction(async (tx) => {
    const billNo = await nextVendorBillNo(tx);
    return tx.vendorBill.create({
      data: {
        billNo,
        vendorBillNo: input.vendorBillNo ?? null,
        vendorId: input.vendorId,
        poId: input.poId ?? null,
        status,
        issueDate: new Date(input.issueDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        subtotal,
        taxTotal,
        grandTotal,
        notes: input.notes ?? null,
        lines: {
          create: lineCalcs.map((l) => ({
            sortOrder: l.idx,
            description: l.description,
            unit: l.unit,
            quantity: l.qty,
            unitPrice: l.price,
            gstRatePct: l.gstPct,
            lineSubtotal: l.lineSubtotal,
            lineTax: l.lineTax,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "VendorBill",
      entityId: bill.id,
    },
  });

  revalidatePath("/procurement/vendor-bills");
  return bill;
}

export async function matchVendorBill(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  // Minimal three-way match: bill total must equal PO total (±₹1 rounding).
  // In production this would also check GRN acceptedQty per line.
  const bill = await db.vendorBill.findUniqueOrThrow({
    where: { id },
    include: { po: true },
  });
  if (!bill.po) {
    throw new Error("Bill has no PO link — cannot match");
  }

  const diff = bill.grandTotal.minus(bill.po.grandTotal).abs();
  const ok = diff.lte(1);

  const updated = await db.vendorBill.update({
    where: { id },
    data: {
      status: ok ? "MATCHED" : "DISCREPANCY",
      matchedByUserId: session.user.id,
      matchedAt: new Date(),
      discrepancyNote: ok ? null : `Bill ${bill.grandTotal} vs PO ${bill.po.grandTotal}`,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: ok ? "MATCH" : "FLAG_DISCREPANCY",
      entity: "VendorBill",
      entityId: id,
    },
  });

  revalidatePath("/procurement/vendor-bills");
  revalidatePath(`/procurement/vendor-bills/${id}`);
  return updated;
}

export async function approveVendorBill(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const bill = await db.vendorBill.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "APPROVE",
      entity: "VendorBill",
      entityId: id,
    },
  });

  revalidatePath("/procurement/vendor-bills");
  revalidatePath(`/procurement/vendor-bills/${id}`);
  return bill;
}

export async function markVendorBillPaid(id: string, amount?: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const bill = await db.vendorBill.findUniqueOrThrow({ where: { id } });
  const paid = amount ? new D(amount) : bill.grandTotal;

  const updated = await db.vendorBill.update({
    where: { id },
    data: {
      status: "PAID",
      amountPaid: paid,
      paidAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MARK_PAID",
      entity: "VendorBill",
      entityId: id,
    },
  });

  revalidatePath("/procurement/vendor-bills");
  revalidatePath(`/procurement/vendor-bills/${id}`);
  return updated;
}
