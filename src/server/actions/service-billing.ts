"use server";

// Create a DRAFT ClientInvoice for a BILLABLE service ticket. Line items
// come from the ticket's resolving ServiceVisit's partsUsed (if any) plus a
// labour-charge catch-all. Uses the existing ClientInvoice pipeline —
// `issueInvoice` in `client-invoices.ts` is still the one that assigns a real
// invoice number at send time.

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import {
  InvoiceKind,
  InvoiceStatus,
  Prisma,
  Role,
  ServiceCoverage,
  ServiceStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";

const D = Prisma.Decimal;

function newShareToken(): string {
  return randomBytes(32).toString("hex");
}

function draftInvoiceNo(): string {
  return `DRAFT-${newShareToken().slice(0, 10).toUpperCase()}`;
}

type PartLine = {
  sku?: string;
  description: string;
  qty: string | number;
  unit: string;
  unitPrice?: string | number;
};

/**
 * Generate a DRAFT ClientInvoice for a RESOLVED/VERIFIED/CLOSED BILLABLE
 * ticket. The ticket's `billableAmount` (if set) becomes a labour line; any
 * parts with unit prices become separate lines.
 */
export async function billServiceIssue(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    include: {
      visits: {
        orderBy: { createdAt: "desc" },
      },
      client: { select: { stateCode: true } },
      invoice: { select: { id: true } },
    },
  });
  if (!issue) throw new Error("Ticket not found");
  if (issue.coverage !== ServiceCoverage.BILLABLE) {
    throw new Error(`Cannot bill a ${issue.coverage} ticket`);
  }
  if (
    issue.status !== ServiceStatus.RESOLVED &&
    issue.status !== ServiceStatus.VERIFIED &&
    issue.status !== ServiceStatus.CLOSED
  ) {
    throw new Error(`Ticket must be RESOLVED/VERIFIED/CLOSED to bill (is ${issue.status})`);
  }
  if (issue.invoice) {
    throw new Error("Ticket already has an invoice");
  }
  if (!issue.client) throw new Error("Ticket has no client");

  // Collect partsUsed across all visits.
  const parts: PartLine[] = [];
  for (const v of issue.visits) {
    if (Array.isArray(v.partsUsed)) {
      for (const p of v.partsUsed as unknown as PartLine[]) {
        if (p && typeof p === "object") parts.push(p);
      }
    }
  }

  // Line shape: parts (if unitPrice given) + labour catch-all (billableAmount).
  type InvLine = {
    description: string;
    qty: Prisma.Decimal;
    unit: string;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  };
  const partLines: InvLine[] = parts
    .filter((p) => p.unitPrice !== undefined && Number(p.unitPrice) > 0)
    .map((p) => {
      const qty = new D(String(p.qty));
      const unitPrice = new D(String(p.unitPrice));
      return {
        description: p.description,
        qty,
        unit: p.unit,
        unitPrice,
        subtotal: qty.mul(unitPrice),
      };
    });

  const labourAmount = issue.billableAmount ?? new D(0);
  const labourLine: InvLine | null = labourAmount.gt(0)
    ? {
        description: `Service call — ${issue.ticketNo}`,
        qty: new D(1),
        unit: "call",
        unitPrice: labourAmount,
        subtotal: labourAmount,
      }
    : null;

  const allLines: InvLine[] = [...partLines];
  if (labourLine) allLines.push(labourLine);
  if (allLines.length === 0) {
    throw new Error("Nothing to bill — set billableAmount or add parts with unit prices");
  }

  const subtotal = allLines.reduce((a, l) => a.add(l.subtotal), new D(0));
  // GST is left at zero at draft time — the manager will pick place-of-supply
  // and run the usual replaceInvoiceLines recompute before issuing.

  const invoice = await db.$transaction(async (tx) => {
    const inv = await tx.clientInvoice.create({
      data: {
        invoiceNo: draftInvoiceNo(),
        kind: InvoiceKind.SERVICE_CALL,
        status: InvoiceStatus.DRAFT,
        projectId: issue.projectId,
        clientId: issue.clientId,
        placeOfSupplyStateCode: issue.client!.stateCode,
        subtotal,
        cgst: new D(0),
        sgst: new D(0),
        igst: new D(0),
        taxTotal: new D(0),
        grandTotal: subtotal,
        notes: `Service ticket ${issue.ticketNo}`,
        serviceIssueId: issue.id,
        createdById: session.user.id,
        shareToken: newShareToken(),
      },
    });

    await tx.clientInvoiceLine.createMany({
      data: allLines.map((l, i) => ({
        invoiceId: inv.id,
        sortOrder: i,
        description: l.description,
        quantity: l.qty,
        unit: l.unit,
        unitPrice: l.unitPrice,
        discountPct: new D(0),
        gstRatePct: new D(0),
        lineSubtotal: l.subtotal,
        lineTax: new D(0),
        lineTotal: l.subtotal,
      })),
    });

    return inv;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "BILL",
      entity: "ServiceIssue",
      entityId: issue.id,
    },
  });

  revalidatePath(`/service/issues/${issue.id}`);
  revalidatePath(`/invoices/${invoice.id}`);
  return { invoiceId: invoice.id };
}
