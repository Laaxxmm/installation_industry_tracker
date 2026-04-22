"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import {
  BudgetCategory,
  Prisma,
  QuoteEventKind,
  QuoteStatus,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import {
  QuoteCreateInput,
  QuoteHeaderInput,
  QuoteLineInput,
} from "@/lib/validators";
import { computeLine, summarise } from "@/lib/gst";
import { sabStateCode } from "@/lib/org";

function formatQuoteNo(year: number, seq: number): string {
  return `SAB-Q-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextQuoteNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const existing = await tx.quoteNumberSequence.findUnique({ where: { year } });
  if (!existing) {
    await tx.quoteNumberSequence.create({ data: { year, next: 2 } });
    return formatQuoteNo(year, 1);
  }
  const claimed = existing.next;
  await tx.quoteNumberSequence.update({
    where: { year },
    data: { next: { increment: 1 } },
  });
  return formatQuoteNo(year, claimed);
}

function newShareToken(): string {
  return randomBytes(32).toString("hex");
}

type LineRow = (typeof QuoteLineInput)["_output"];

function recalcTotals(
  lines: LineRow[],
  placeOfSupplyStateCode: string,
): {
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  perLine: Array<{ subtotal: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }>;
} {
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
    taxTotal: new Prisma.Decimal(summary.taxTotal.toString()),
    grandTotal: new Prisma.Decimal(summary.grandTotal.toString()),
    perLine,
  };
}

export async function createQuote(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = QuoteCreateInput.parse(raw);

  const lines = input.lines;
  const totals = recalcTotals(lines, input.placeOfSupplyStateCode);

  const quote = await db.$transaction(async (tx) => {
    const quoteNo = await nextQuoteNo(tx);
    const shareToken = newShareToken();

    const q = await tx.quote.create({
      data: {
        quoteNo,
        shareToken,
        clientId: input.clientId,
        title: input.title,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        placeOfSupplyStateCode: input.placeOfSupplyStateCode,
        notes: input.notes ?? null,
        termsMd: input.termsMd ?? null,
        status: QuoteStatus.DRAFT,
        createdById: session.user.id,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        lines: {
          create: lines.map((l, i) => ({
            sortOrder: i,
            category: l.category as BudgetCategory,
            description: l.description,
            hsnSac: l.hsnSac ?? null,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            gstRatePct: l.gstRatePct,
            lineSubtotal: totals.perLine[i]!.subtotal,
            lineTax: totals.perLine[i]!.tax,
            lineTotal: totals.perLine[i]!.total,
          })),
        },
      },
    });

    await tx.quoteEvent.create({
      data: {
        quoteId: q.id,
        kind: QuoteEventKind.NOTE,
        note: "Quote created",
        toStatus: QuoteStatus.DRAFT,
        actorUserId: session.user.id,
      },
    });

    return q;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "Quote",
      entityId: quote.id,
    },
  });

  revalidatePath("/quotes");
  return quote;
}

/**
 * Replace all lines on a DRAFT/REVISED/CHANGES_REQUESTED quote and recompute totals.
 */
export async function replaceQuoteLines(
  quoteId: string,
  raw: {
    placeOfSupplyStateCode?: string;
    lines: Array<(typeof QuoteLineInput)["_input"]>;
  },
) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const parsed = raw.lines.map((l) => QuoteLineInput.parse(l));

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true, placeOfSupplyStateCode: true },
  });
  if (!quote) throw new Error("Quote not found");

  const editable: QuoteStatus[] = [
    QuoteStatus.DRAFT,
    QuoteStatus.REVISED,
    QuoteStatus.CHANGES_REQUESTED,
  ];
  if (!editable.includes(quote.status)) {
    throw new Error(`Cannot edit lines while quote is ${quote.status}`);
  }

  const placeOfSupply =
    raw.placeOfSupplyStateCode ?? quote.placeOfSupplyStateCode;
  const totals = recalcTotals(parsed, placeOfSupply);

  await db.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId } });
    await tx.quoteLine.createMany({
      data: parsed.map((l, i) => ({
        quoteId,
        sortOrder: i,
        category: l.category as BudgetCategory,
        description: l.description,
        hsnSac: l.hsnSac ?? null,
        quantity: new Prisma.Decimal(l.quantity),
        unit: l.unit,
        unitPrice: new Prisma.Decimal(l.unitPrice),
        discountPct: new Prisma.Decimal(l.discountPct),
        gstRatePct: new Prisma.Decimal(l.gstRatePct),
        lineSubtotal: totals.perLine[i]!.subtotal,
        lineTax: totals.perLine[i]!.tax,
        lineTotal: totals.perLine[i]!.total,
      })),
    });
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        placeOfSupplyStateCode: placeOfSupply,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_LINES",
      entity: "Quote",
      entityId: quoteId,
    },
  });
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

export async function updateQuoteHeader(quoteId: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = QuoteHeaderInput.parse(raw);

  const existing = await db.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true, lines: { select: { id: true } } },
  });
  if (!existing) throw new Error("Quote not found");

  const editable: QuoteStatus[] = [
    QuoteStatus.DRAFT,
    QuoteStatus.REVISED,
    QuoteStatus.CHANGES_REQUESTED,
  ];
  if (!editable.includes(existing.status)) {
    throw new Error(`Cannot edit quote in status ${existing.status}`);
  }

  // Place-of-supply change may flip intra/inter-state → recompute totals.
  const lines = await db.quoteLine.findMany({
    where: { quoteId },
    orderBy: { sortOrder: "asc" },
  });
  const totals = recalcTotals(
    lines.map((l) => ({
      id: l.id,
      category: l.category,
      description: l.description,
      hsnSac: l.hsnSac,
      quantity: l.quantity.toString(),
      unit: l.unit,
      unitPrice: l.unitPrice.toString(),
      discountPct: l.discountPct.toString(),
      gstRatePct: l.gstRatePct.toString(),
    })) as LineRow[],
    input.placeOfSupplyStateCode,
  );

  await db.quote.update({
    where: { id: quoteId },
    data: {
      clientId: input.clientId,
      title: input.title,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      placeOfSupplyStateCode: input.placeOfSupplyStateCode,
      notes: input.notes ?? null,
      termsMd: input.termsMd ?? null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_HEADER",
      entity: "Quote",
      entityId: quoteId,
    },
  });
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

export async function sendQuote(quoteId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const q = await db.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, shareToken: true },
  });
  if (!q) throw new Error("Quote not found");

  const fromStatus = q.status;
  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.SENT,
        sentAt: new Date(),
      },
    });
    await tx.quoteEvent.create({
      data: {
        quoteId,
        kind: QuoteEventKind.SENT,
        fromStatus,
        toStatus: QuoteStatus.SENT,
        actorUserId: session.user.id,
      },
    });
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

export async function recordQuoteFeedback(
  quoteId: string,
  kind: "ALTERATION_REQUESTED" | "CUSTOMIZATION_REQUESTED" | "NEGOTIATION",
  note: string,
) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const q = await db.quote.findUnique({
    where: { id: quoteId },
    select: { status: true },
  });
  if (!q) throw new Error("Quote not found");

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.CHANGES_REQUESTED },
    });
    await tx.quoteEvent.create({
      data: {
        quoteId,
        kind: QuoteEventKind[kind],
        note,
        fromStatus: q.status,
        toStatus: QuoteStatus.CHANGES_REQUESTED,
        actorUserId: session.user.id,
      },
    });
  });

  revalidatePath(`/quotes/${quoteId}`);
}

export async function addQuoteNote(quoteId: string, note: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  await db.quoteEvent.create({
    data: {
      quoteId,
      kind: QuoteEventKind.NOTE,
      note,
      actorUserId: session.user.id,
    },
  });
  revalidatePath(`/quotes/${quoteId}`);
}

export async function acceptQuote(quoteId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const q = await db.quote.findUnique({
    where: { id: quoteId },
    select: { status: true },
  });
  if (!q) throw new Error("Quote not found");

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
    });
    await tx.quoteEvent.create({
      data: {
        quoteId,
        kind: QuoteEventKind.ACCEPTED,
        fromStatus: q.status,
        toStatus: QuoteStatus.ACCEPTED,
        actorUserId: session.user.id,
      },
    });
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

export async function markQuoteLost(quoteId: string, note?: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const q = await db.quote.findUnique({
    where: { id: quoteId },
    select: { status: true },
  });
  if (!q) throw new Error("Quote not found");

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.LOST },
    });
    await tx.quoteEvent.create({
      data: {
        quoteId,
        kind: QuoteEventKind.REJECTED,
        note: note ?? null,
        fromStatus: q.status,
        toStatus: QuoteStatus.LOST,
        actorUserId: session.user.id,
      },
    });
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

export async function expireStaleQuotes() {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const now = new Date();
  const stale = await db.quote.findMany({
    where: {
      status: QuoteStatus.SENT,
      validUntil: { not: null, lt: now },
    },
    select: { id: true, status: true },
  });
  for (const q of stale) {
    await db.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: q.id },
        data: { status: QuoteStatus.EXPIRED },
      });
      await tx.quoteEvent.create({
        data: {
          quoteId: q.id,
          kind: QuoteEventKind.NOTE,
          note: "Automatically expired (past validUntil)",
          fromStatus: q.status,
          toStatus: QuoteStatus.EXPIRED,
        },
      });
    });
  }
  revalidatePath("/quotes");
  return { expired: stale.length };
}

/**
 * Clone a quote to v+1, leaving the previous revision frozen.
 * The new quote is linked via parentQuoteId and starts in REVISED status.
 */
export async function reviseQuote(quoteId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const source = await db.quote.findUnique({
    where: { id: quoteId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) throw new Error("Quote not found");
  if (source.status === QuoteStatus.CONVERTED) {
    throw new Error("Cannot revise a converted quote");
  }

  const revised = await db.$transaction(async (tx) => {
    const quoteNo = await nextQuoteNo(tx);
    const shareToken = newShareToken();
    const q = await tx.quote.create({
      data: {
        quoteNo,
        shareToken,
        clientId: source.clientId,
        title: source.title,
        status: QuoteStatus.REVISED,
        version: source.version + 1,
        parentQuoteId: source.id,
        validUntil: source.validUntil,
        placeOfSupplyStateCode: source.placeOfSupplyStateCode,
        notes: source.notes,
        termsMd: source.termsMd,
        createdById: session.user.id,
        subtotal: source.subtotal,
        taxTotal: source.taxTotal,
        grandTotal: source.grandTotal,
        lines: {
          create: source.lines.map((l, i) => ({
            sortOrder: i,
            category: l.category,
            description: l.description,
            hsnSac: l.hsnSac,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            gstRatePct: l.gstRatePct,
            lineSubtotal: l.lineSubtotal,
            lineTax: l.lineTax,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });
    await tx.quoteEvent.create({
      data: {
        quoteId: q.id,
        kind: QuoteEventKind.REVISION_ISSUED,
        note: `Revised from ${source.quoteNo} (v${source.version})`,
        toStatus: QuoteStatus.REVISED,
        actorUserId: session.user.id,
      },
    });
    return q;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REVISE",
      entity: "Quote",
      entityId: revised.id,
    },
  });
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return revised;
}

export async function rotateQuoteShareToken(quoteId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const shareToken = newShareToken();
  await db.quote.update({ where: { id: quoteId }, data: { shareToken } });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ROTATE_SHARE_TOKEN",
      entity: "Quote",
      entityId: quoteId,
    },
  });
  revalidatePath(`/quotes/${quoteId}`);
  return shareToken;
}
