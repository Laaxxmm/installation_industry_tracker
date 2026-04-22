"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import {
  InvoiceStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import {
  ClientInvoiceCreateInput,
  ClientInvoiceLineInput,
} from "@/lib/validators";
import { computeLine, summarise } from "@/lib/gst";
import { sabStateCode } from "@/lib/org";

function formatInvoiceNo(year: number, seq: number): string {
  return `SAB-INV-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextInvoiceNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const existing = await tx.clientInvoiceNumberSequence.findUnique({
    where: { year },
  });
  if (!existing) {
    await tx.clientInvoiceNumberSequence.create({ data: { year, next: 2 } });
    return formatInvoiceNo(year, 1);
  }
  const claimed = existing.next;
  await tx.clientInvoiceNumberSequence.update({
    where: { year },
    data: { next: { increment: 1 } },
  });
  return formatInvoiceNo(year, claimed);
}

function newShareToken(): string {
  return randomBytes(32).toString("hex");
}

type LineRow = (typeof ClientInvoiceLineInput)["_output"];

function recalcTotals(lines: LineRow[], placeOfSupplyStateCode: string) {
  const summary = summarise({
    lines: lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      gstRatePct: l.gstRatePct,
    })),
    supplierStateCode: sabStateCode(),
    placeOfSupplyStateCode,
  });
  const perLine = lines.map((l) => {
    const r = computeLine({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      gstRatePct: l.gstRatePct,
    });
    return {
      subtotal: new Prisma.Decimal(r.subtotal.toString()),
      tax: new Prisma.Decimal(r.tax.toString()),
      total: new Prisma.Decimal(r.total.toString()),
    };
  });
  return {
    subtotal: new Prisma.Decimal(summary.subtotal.toString()),
    cgst: new Prisma.Decimal(summary.cgst.toString()),
    sgst: new Prisma.Decimal(summary.sgst.toString()),
    igst: new Prisma.Decimal(summary.igst.toString()),
    taxTotal: new Prisma.Decimal(summary.taxTotal.toString()),
    grandTotal: new Prisma.Decimal(summary.grandTotal.toString()),
    perLine,
  };
}

/**
 * Create a new draft client invoice. Invoice number is NOT yet assigned —
 * that happens at issueInvoice time so we don't burn sequence numbers on
 * abandoned drafts.
 */
export async function createClientInvoice(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = ClientInvoiceCreateInput.parse(raw);

  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, clientId: true },
  });
  if (!project) throw new Error("Project not found");
  if (!project.clientId) {
    throw new Error("Project is not linked to a Client. Attach a client first.");
  }

  const totals = recalcTotals(input.lines, input.placeOfSupplyStateCode);

  const invoice = await db.$transaction(async (tx) => {
    const shareToken = newShareToken();
    // Use a temporary invoiceNo = token-prefixed DRAFT marker; will be
    // replaced at issue time. The schema requires @unique + non-null, so
    // we use a guaranteed-unique draft code.
    const draftNo = `DRAFT-${shareToken.slice(0, 10).toUpperCase()}`;

    const inv = await tx.clientInvoice.create({
      data: {
        invoiceNo: draftNo,
        kind: input.kind,
        status: InvoiceStatus.DRAFT,
        projectId: project.id,
        clientId: project.clientId!,
        placeOfSupplyStateCode: input.placeOfSupplyStateCode,
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        poRef: input.poRef ?? null,
        notes: input.notes ?? null,
        termsMd: input.termsMd ?? null,
        createdById: session.user.id,
        shareToken,
      },
    });

    if (input.lines.length > 0) {
      await tx.clientInvoiceLine.createMany({
        data: input.lines.map((l, i) => ({
          invoiceId: inv.id,
          sortOrder: i,
          description: l.description,
          hsnSac: l.hsnSac ?? null,
          quantity: new Prisma.Decimal(l.quantity),
          unit: l.unit,
          unitPrice: new Prisma.Decimal(l.unitPrice),
          discountPct: new Prisma.Decimal(l.discountPct),
          gstRatePct: new Prisma.Decimal(l.gstRatePct),
          lineSubtotal: totals.perLine[i].subtotal,
          lineTax: totals.perLine[i].tax,
          lineTotal: totals.perLine[i].total,
        })),
      });
    }

    return inv;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "ClientInvoice",
      entityId: invoice.id,
    },
  });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoice.id}`);
  return { invoiceId: invoice.id };
}

/** Replace all lines of a DRAFT invoice; recompute totals. ISSUED invoices are frozen. */
export async function replaceInvoiceLines(raw: {
  invoiceId: string;
  lines: unknown[];
}) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const lines = raw.lines.map((l) => ClientInvoiceLineInput.parse(l));

  const invoice = await db.clientInvoice.findUnique({
    where: { id: raw.invoiceId },
    select: { status: true, placeOfSupplyStateCode: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error("Invoice is frozen — only DRAFT can be edited");
  }

  const totals = recalcTotals(lines, invoice.placeOfSupplyStateCode);

  await db.$transaction(async (tx) => {
    await tx.clientInvoiceLine.deleteMany({
      where: { invoiceId: raw.invoiceId },
    });
    if (lines.length > 0) {
      await tx.clientInvoiceLine.createMany({
        data: lines.map((l, i) => ({
          invoiceId: raw.invoiceId,
          sortOrder: i,
          description: l.description,
          hsnSac: l.hsnSac ?? null,
          quantity: new Prisma.Decimal(l.quantity),
          unit: l.unit,
          unitPrice: new Prisma.Decimal(l.unitPrice),
          discountPct: new Prisma.Decimal(l.discountPct),
          gstRatePct: new Prisma.Decimal(l.gstRatePct),
          lineSubtotal: totals.perLine[i].subtotal,
          lineTax: totals.perLine[i].tax,
          lineTotal: totals.perLine[i].total,
        })),
      });
    }
    await tx.clientInvoice.update({
      where: { id: raw.invoiceId },
      data: {
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_LINES",
      entity: "ClientInvoice",
      entityId: raw.invoiceId,
    },
  });
  revalidatePath(`/invoices/${raw.invoiceId}`);
}

/** Update editable header fields on a DRAFT invoice. */
export async function updateInvoiceHeader(raw: {
  invoiceId: string;
  placeOfSupplyStateCode?: string;
  dueAt?: string | null;
  poRef?: string | null;
  notes?: string | null;
  termsMd?: string | null;
  kind?: "ADVANCE" | "PROGRESS" | "FINAL" | "ADHOC";
}) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const invoice = await db.clientInvoice.findUnique({
    where: { id: raw.invoiceId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error("Invoice is frozen — only DRAFT can be edited");
  }

  const nextPlaceOfSupply =
    raw.placeOfSupplyStateCode ?? invoice.placeOfSupplyStateCode;
  const posChanged =
    raw.placeOfSupplyStateCode !== undefined &&
    raw.placeOfSupplyStateCode !== invoice.placeOfSupplyStateCode;

  let totals: ReturnType<typeof recalcTotals> | null = null;
  if (posChanged) {
    totals = recalcTotals(
      invoice.lines.map((l) => ({
        description: l.description,
        hsnSac: l.hsnSac ?? undefined,
        quantity: l.quantity.toString(),
        unit: l.unit,
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        gstRatePct: l.gstRatePct.toString(),
      })),
      nextPlaceOfSupply,
    );
  }

  await db.clientInvoice.update({
    where: { id: raw.invoiceId },
    data: {
      placeOfSupplyStateCode: nextPlaceOfSupply,
      dueAt:
        raw.dueAt === undefined
          ? undefined
          : raw.dueAt
            ? new Date(raw.dueAt)
            : null,
      poRef: raw.poRef === undefined ? undefined : (raw.poRef ?? null),
      notes: raw.notes === undefined ? undefined : (raw.notes ?? null),
      termsMd: raw.termsMd === undefined ? undefined : (raw.termsMd ?? null),
      kind: raw.kind ?? undefined,
      ...(totals && {
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      }),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_HEADER",
      entity: "ClientInvoice",
      entityId: raw.invoiceId,
    },
  });
  revalidatePath(`/invoices/${raw.invoiceId}`);
}

/** Assign sequence invoice number, stamp issuedAt, set status ISSUED. */
export async function issueInvoice(invoiceId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const invoice = await db.clientInvoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { select: { id: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error("Only DRAFT invoices can be issued");
  }
  if (invoice.lines.length === 0) {
    throw new Error("Add at least one line before issuing");
  }

  const result = await db.$transaction(async (tx) => {
    const invoiceNo = await nextInvoiceNo(tx);
    const updated = await tx.clientInvoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNo,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });
    return updated;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: `ISSUE:${result.invoiceNo}`,
      entity: "ClientInvoice",
      entityId: invoiceId,
    },
  });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/projects");
  return { invoiceNo: result.invoiceNo };
}

export async function markInvoicePaid(raw: {
  invoiceId: string;
  amountPaid: string;
  paidAt: string;
}) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const invoice = await db.clientInvoice.findUnique({
    where: { id: raw.invoiceId },
    select: { status: true, grandTotal: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.ISSUED) {
    throw new Error("Only ISSUED invoices can be marked paid");
  }

  const amountPaid = new Prisma.Decimal(raw.amountPaid);
  const paidAt = new Date(raw.paidAt);
  const fullyPaid = amountPaid.greaterThanOrEqualTo(invoice.grandTotal);

  await db.clientInvoice.update({
    where: { id: raw.invoiceId },
    data: {
      amountPaid,
      paidAt,
      status: fullyPaid ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: fullyPaid ? "MARK_PAID" : "PART_PAID",
      entity: "ClientInvoice",
      entityId: raw.invoiceId,
    },
  });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${raw.invoiceId}`);
  revalidatePath("/projects");
}

export async function cancelInvoice(raw: { invoiceId: string; reason: string }) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  if (!raw.reason || raw.reason.trim().length < 3) {
    throw new Error("Cancellation reason required (min 3 chars)");
  }
  const invoice = await db.clientInvoice.findUnique({
    where: { id: raw.invoiceId },
    select: { status: true, notes: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new Error("Already cancelled");
  }

  const stampedNotes = [
    invoice.notes ?? "",
    `\n\n— CANCELLED ${new Date().toISOString()} — ${raw.reason.trim()}`,
  ]
    .join("")
    .trim();

  await db.clientInvoice.update({
    where: { id: raw.invoiceId },
    data: {
      status: InvoiceStatus.CANCELLED,
      notes: stampedNotes,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CANCEL",
      entity: "ClientInvoice",
      entityId: raw.invoiceId,
    },
  });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${raw.invoiceId}`);
  revalidatePath("/projects");
}

export async function rotateInvoiceShareToken(invoiceId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const shareToken = newShareToken();
  await db.clientInvoice.update({
    where: { id: invoiceId },
    data: { shareToken },
  });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ROTATE_SHARE",
      entity: "ClientInvoice",
      entityId: invoiceId,
    },
  });
  revalidatePath(`/invoices/${invoiceId}`);
  return { shareToken };
}

export async function deleteDraftInvoice(invoiceId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const invoice = await db.clientInvoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new Error("Only DRAFT invoices can be deleted");
  }
  await db.clientInvoice.delete({ where: { id: invoiceId } });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_DRAFT",
      entity: "ClientInvoice",
      entityId: invoiceId,
    },
  });
  revalidatePath("/invoices");
}
