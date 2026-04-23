"use server";

// AMC contract lifecycle: create → approve → active → (hold | cancel | expire)
// → renew. Approval pre-generates all AMCVisit rows so the calendar and
// "visits remaining" queries are just a findMany. Approval also branches on
// `billingMode` to create DRAFT ClientInvoice rows for ANNUAL / INSTALLMENTS
// contracts; PER_VISIT contracts generate invoices lazily at visit completion.

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import {
  AMCBillingMode,
  AMCStatus,
  AMCVisitStatus,
  InvoiceKind,
  InvoiceStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { AMCInput } from "@/lib/validators";
import { addMonths, computeVisitSchedule } from "@/lib/amc-schedule";

const D = Prisma.Decimal;

// Indian FY: April–March. Share convention with procurement + client invoices.
function fyFor(date = new Date()): number {
  const m = date.getMonth();
  return m >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function fyLabel(year: number): string {
  // "25-26" for FY starting in 2025.
  return `${pad(year % 100, 2)}-${pad((year + 1) % 100, 2)}`;
}

async function nextAMCNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = fyFor();
  const row = await tx.aMCNumberSequence.upsert({
    where: { year },
    update: { next: { increment: 1 } },
    // First allocation ever for this FY: claim #1001 and leave next at 1002.
    create: { year, next: 1002 },
  });
  // row.next is AFTER increment (or 1002 on create). Claim the value we just
  // reserved: the pre-increment value, clamped to at least 1001.
  const claimed = Math.max(1001, row.next - 1);
  return `AMC-${fyLabel(year)}-${pad(claimed, 4)}`;
}

function newShareToken(): string {
  return randomBytes(32).toString("hex");
}

function draftInvoiceNo(): string {
  return `DRAFT-${newShareToken().slice(0, 10).toUpperCase()}`;
}

function computeGrandTotal(annualValue: Prisma.Decimal, taxPct: Prisma.Decimal, years: number): Prisma.Decimal {
  const base = annualValue.mul(years);
  const tax = base.mul(taxPct).div(100);
  return base.add(tax);
}

// Rough "years covered" = ceil(endDate - startDate) / 365 in whole years, for
// computing total invoice counts across multi-year contracts. A 1-year
// QUARTERLY contract → 1 year → 4 visits; a 2-year → 2 years → 8 visits.
function contractYears(startDate: Date, endDate: Date): number {
  const ms = endDate.getTime() - startDate.getTime();
  const years = ms / (365 * 24 * 60 * 60 * 1000);
  return Math.max(1, Math.round(years));
}

/**
 * Create a new AMC in DRAFT status with SLA child rows pre-seeded.
 * Grand-total is derived from annualValue × years × (1 + taxPct/100).
 */
export async function createAMC(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = AMCInput.parse(raw);

  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, clientId: true },
  });
  if (!project) throw new Error("Project not found");
  if (project.clientId && project.clientId !== input.clientId) {
    throw new Error("Project's client does not match the AMC's client");
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const annualValue = new D(input.annualValue);
  const taxPct = new D(input.taxPct);
  const years = contractYears(startDate, endDate);
  const grandTotal = computeGrandTotal(annualValue, taxPct, years);

  const amc = await db.$transaction(async (tx) => {
    const contractNo = await nextAMCNo(tx);
    const created = await tx.aMC.create({
      data: {
        contractNo,
        title: input.title,
        clientId: input.clientId,
        projectId: input.projectId,
        type: input.type,
        billingMode: input.billingMode,
        status: AMCStatus.DRAFT,
        startDate,
        endDate,
        frequency: input.frequency,
        visitsPerYear: input.visitsPerYear,
        annualValue,
        taxPct,
        grandTotal,
        siteAddress: input.siteAddress,
        assetsCovered: input.assetsCovered as Prisma.InputJsonValue,
        exclusions: input.exclusions ?? null,
        notes: input.notes ?? null,
        slas: {
          create: input.slas.map((s) => ({
            priority: s.priority,
            responseHours: s.responseHours,
            resolutionHours: s.resolutionHours,
          })),
        },
      },
    });
    return created;
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "AMC",
      entityId: amc.id,
    },
  });

  revalidatePath("/amcs");
  return { amcId: amc.id, contractNo: amc.contractNo };
}

/**
 * Approve + activate an AMC:
 *  1. Flip status to ACTIVE, stamp activatedAt/approvedBy.
 *  2. Pre-generate all AMCVisit rows at evenly-spaced dates.
 *  3. Branch on billingMode:
 *       ANNUAL       → 1 DRAFT ClientInvoice (full grandTotal, dated startDate).
 *       INSTALLMENTS → N DRAFT ClientInvoices (one per visit period).
 *       PER_VISIT    → no invoice here — created on visit completion.
 */
export async function approveAMC(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const amc = await db.aMC.findUnique({
    where: { id },
    include: { slas: true },
  });
  if (!amc) throw new Error("AMC not found");
  if (amc.status !== AMCStatus.DRAFT && amc.status !== AMCStatus.PENDING_APPROVAL) {
    throw new Error(`Cannot approve AMC in status ${amc.status}`);
  }
  if (amc.slas.length === 0) {
    throw new Error("AMC has no SLA rows — add at least one before approving");
  }

  // Visit dates across the full contract window.
  const visitDates = computeVisitSchedule({
    startDate: amc.startDate,
    endDate: amc.endDate,
    frequency: amc.frequency,
  });
  if (visitDates.length === 0) {
    throw new Error("Contract window produces zero visits — check dates/frequency");
  }

  // Client state code for invoice place-of-supply; falls back to the project's
  // client in case the AMC's client changed post-draft.
  const client = await db.client.findUnique({
    where: { id: amc.clientId },
    select: { stateCode: true },
  });
  if (!client) throw new Error("AMC client not found");

  await db.$transaction(async (tx) => {
    // 1. Activate.
    await tx.aMC.update({
      where: { id: amc.id },
      data: {
        status: AMCStatus.ACTIVE,
        approvedByUserId: session.user.id,
        approvedAt: new Date(),
        activatedAt: new Date(),
      },
    });

    // 2. Pre-generate visits.
    await tx.aMCVisit.createMany({
      data: visitDates.map((d, i) => ({
        amcId: amc.id,
        visitNo: i + 1,
        scheduledDate: d,
        status: AMCVisitStatus.SCHEDULED,
      })),
    });

    // 3. Invoice generation by billing mode.
    if (amc.billingMode === AMCBillingMode.ANNUAL) {
      await tx.clientInvoice.create({
        data: {
          invoiceNo: draftInvoiceNo(),
          kind: InvoiceKind.AMC_CONTRACT,
          status: InvoiceStatus.DRAFT,
          projectId: amc.projectId,
          clientId: amc.clientId,
          placeOfSupplyStateCode: client.stateCode,
          subtotal: amc.annualValue.mul(contractYears(amc.startDate, amc.endDate)),
          cgst: new D(0),
          sgst: new D(0),
          igst: new D(0),
          taxTotal: amc.grandTotal.sub(
            amc.annualValue.mul(contractYears(amc.startDate, amc.endDate)),
          ),
          grandTotal: amc.grandTotal,
          dueAt: amc.endDate,
          notes: `AMC contract ${amc.contractNo}`,
          amcId: amc.id,
          createdById: session.user.id,
          shareToken: newShareToken(),
        },
      });
    } else if (amc.billingMode === AMCBillingMode.INSTALLMENTS) {
      const perInstallment = amc.grandTotal.div(visitDates.length);
      const perInstallmentBase = amc.annualValue
        .mul(contractYears(amc.startDate, amc.endDate))
        .div(visitDates.length);
      const perInstallmentTax = perInstallment.sub(perInstallmentBase);
      for (let i = 0; i < visitDates.length; i++) {
        await tx.clientInvoice.create({
          data: {
            invoiceNo: draftInvoiceNo(),
            kind: InvoiceKind.AMC_INSTALLMENT,
            status: InvoiceStatus.DRAFT,
            projectId: amc.projectId,
            clientId: amc.clientId,
            placeOfSupplyStateCode: client.stateCode,
            subtotal: perInstallmentBase,
            cgst: new D(0),
            sgst: new D(0),
            igst: new D(0),
            taxTotal: perInstallmentTax,
            grandTotal: perInstallment,
            dueAt: visitDates[i],
            notes: `AMC ${amc.contractNo} — installment ${i + 1}/${visitDates.length}`,
            amcId: amc.id,
            createdById: session.user.id,
            shareToken: newShareToken(),
          },
        });
      }
    }
    // PER_VISIT: no invoice here.
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "APPROVE",
      entity: "AMC",
      entityId: amc.id,
    },
  });

  revalidatePath("/amcs");
  revalidatePath(`/amcs/${amc.id}`);
  return { amcId: amc.id, visitsCreated: visitDates.length };
}

/** Temporarily pause a contract (e.g. client relocation). Visits still exist. */
export async function holdAMC(id: string, reason: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  if (!reason || reason.trim().length < 3) {
    throw new Error("Reason required to place AMC on hold");
  }
  const amc = await db.aMC.findUnique({ where: { id }, select: { status: true } });
  if (!amc) throw new Error("AMC not found");
  if (amc.status !== AMCStatus.ACTIVE) {
    throw new Error(`Cannot hold AMC in status ${amc.status}`);
  }

  await db.aMC.update({
    where: { id },
    data: { status: AMCStatus.ON_HOLD, notes: reason },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "HOLD",
      entity: "AMC",
      entityId: id,
    },
  });

  revalidatePath("/amcs");
  revalidatePath(`/amcs/${id}`);
}

/** Resume an on-hold contract. */
export async function resumeAMC(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const amc = await db.aMC.findUnique({ where: { id }, select: { status: true } });
  if (!amc) throw new Error("AMC not found");
  if (amc.status !== AMCStatus.ON_HOLD) {
    throw new Error(`Cannot resume AMC in status ${amc.status}`);
  }

  await db.aMC.update({
    where: { id },
    data: { status: AMCStatus.ACTIVE },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "RESUME",
      entity: "AMC",
      entityId: id,
    },
  });

  revalidatePath("/amcs");
  revalidatePath(`/amcs/${id}`);
}

/** Cancel a contract. Remaining SCHEDULED visits move to CANCELLED. */
export async function cancelAMC(id: string, reason: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  if (!reason || reason.trim().length < 3) {
    throw new Error("Reason required to cancel AMC");
  }
  const amc = await db.aMC.findUnique({ where: { id }, select: { status: true } });
  if (!amc) throw new Error("AMC not found");
  if (
    amc.status === AMCStatus.CANCELLED ||
    amc.status === AMCStatus.EXPIRED ||
    amc.status === AMCStatus.RENEWED
  ) {
    throw new Error(`Cannot cancel AMC in status ${amc.status}`);
  }

  await db.$transaction(async (tx) => {
    await tx.aMC.update({
      where: { id },
      data: {
        status: AMCStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: reason,
      },
    });
    await tx.aMCVisit.updateMany({
      where: { amcId: id, status: AMCVisitStatus.SCHEDULED },
      data: { status: AMCVisitStatus.CANCELLED },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CANCEL",
      entity: "AMC",
      entityId: id,
    },
  });

  revalidatePath("/amcs");
  revalidatePath(`/amcs/${id}`);
}

/**
 * Renew a contract: clone as a new DRAFT with parentAmcId set and dates
 * beginning the day after the parent expires. SLA rows are copied verbatim;
 * terms can be overridden via the optional `overrides` payload.
 */
export async function renewAMC(
  id: string,
  overrides?: {
    annualValue?: string;
    taxPct?: string;
    durationMonths?: number; // default = 12
    frequency?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
  },
) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);

  const parent = await db.aMC.findUnique({
    where: { id },
    include: { slas: true },
  });
  if (!parent) throw new Error("AMC not found");
  if (parent.status === AMCStatus.DRAFT) {
    throw new Error("Cannot renew a DRAFT AMC");
  }

  const newStart = new Date(parent.endDate.getTime() + 24 * 60 * 60 * 1000);
  const newFrequency = overrides?.frequency ?? parent.frequency;
  const durationMonths = overrides?.durationMonths ?? 12;
  const newEnd = addMonths(newStart, durationMonths);
  const annualValue = overrides?.annualValue ? new D(overrides.annualValue) : parent.annualValue;
  const taxPct = overrides?.taxPct ? new D(overrides.taxPct) : parent.taxPct;
  const years = Math.max(1, Math.round(durationMonths / 12));
  const grandTotal = computeGrandTotal(annualValue, taxPct, years);

  const child = await db.$transaction(async (tx) => {
    const contractNo = await nextAMCNo(tx);
    // Mark parent as RENEWED once the new contract is stamped.
    await tx.aMC.update({
      where: { id: parent.id },
      data: { status: AMCStatus.RENEWED },
    });
    return tx.aMC.create({
      data: {
        contractNo,
        title: parent.title,
        clientId: parent.clientId,
        projectId: parent.projectId,
        type: parent.type,
        billingMode: parent.billingMode,
        status: AMCStatus.DRAFT,
        startDate: newStart,
        endDate: newEnd,
        frequency: newFrequency,
        visitsPerYear: parent.visitsPerYear,
        annualValue,
        taxPct,
        grandTotal,
        siteAddress: parent.siteAddress,
        assetsCovered: parent.assetsCovered as Prisma.InputJsonValue,
        exclusions: parent.exclusions,
        notes: `Renewal of ${parent.contractNo}`,
        parentAmcId: parent.id,
        slas: {
          create: parent.slas.map((s) => ({
            priority: s.priority,
            responseHours: s.responseHours,
            resolutionHours: s.resolutionHours,
          })),
        },
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "RENEW",
      entity: "AMC",
      entityId: child.id,
    },
  });

  revalidatePath("/amcs");
  revalidatePath(`/amcs/${parent.id}`);
  revalidatePath(`/amcs/${child.id}`);
  return { amcId: child.id, contractNo: child.contractNo };
}
