/* eslint-disable no-console */
// Backfill ClientInvoice records for the projects that already had a
// "Billed Value" in the imported spreadsheet. The earlier
// import-projects-xlsx.ts loaded the numeric column into Project.billedValue
// but the dashboard / reports / AR all read from ClientInvoice rows, so we
// need real invoices to make those KPIs accurate.
//
// Usage:
//   DATABASE_URL='<railway-url>' \
//     IMPORT_CONFIRM=YES \
//     npx tsx scripts/import-billed-invoices.ts
//
// Skips dry-run unless IMPORT_CONFIRM=YES.
//
// One invoice per project (with billedValue > 0), one line per invoice,
// inclusive 18% GST split CGST/SGST 9+9 (intra-state Karnataka 29).

import {
  PrismaClient,
  InvoiceKind,
  InvoiceStatus,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const DRY_RUN = process.env.IMPORT_CONFIRM !== "YES";

// 18% GST. Inclusive split → subtotal = total / 1.18.
const GST_RATE = new Prisma.Decimal("0.18");
const ONE = new Prisma.Decimal(1);
const HALF = new Prisma.Decimal("0.5");

function newShareToken(): string {
  return randomBytes(16).toString("hex");
}

function moneyFromInclusive(grand: Prisma.Decimal): {
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
} {
  // grand_inc_gst = subtotal * (1 + rate)  ⇒  subtotal = grand / (1 + rate)
  const divisor = ONE.plus(GST_RATE);
  const subtotal = grand.dividedBy(divisor).toDecimalPlaces(2);
  const taxTotal = grand.minus(subtotal).toDecimalPlaces(2);
  const cgst = taxTotal.times(HALF).toDecimalPlaces(2);
  const sgst = taxTotal.minus(cgst).toDecimalPlaces(2); // absorbs rounding
  return { subtotal, taxTotal, cgst, sgst };
}

async function main() {
  console.log("=== import-billed-invoices ===");
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(
    `DB:      ${process.env.DATABASE_URL?.replace(/:[^@:]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log();

  // ---------- Find admin user (createdById) ----------
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", active: true },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error("FATAL: no active ADMIN user found to attribute invoices to.");
    process.exit(1);
  }
  console.log(`Attributing imported invoices to: ${admin.email}`);

  // ---------- Find projects with billed values ----------
  const projects = await db.project.findMany({
    where: { billedValue: { gt: 0 } },
    select: {
      id: true,
      code: true,
      clientId: true,
      clientName: true,
      poDate: true,
      billedValue: true,
    },
    orderBy: { code: "asc" },
  });
  console.log(`Projects with billedValue > 0: ${projects.length}`);

  // Skip those without a linked client (can't create invoice without clientId).
  const linked = projects.filter((p) => p.clientId !== null);
  const unlinked = projects.filter((p) => p.clientId === null);
  if (unlinked.length > 0) {
    console.log(
      `  ${unlinked.length} have no clientId (skip): ${unlinked
        .map((p) => p.code)
        .slice(0, 5)
        .join(", ")}${unlinked.length > 5 ? "…" : ""}`,
    );
  }
  console.log(`Will create ${linked.length} invoices.`);

  // ---------- Skip projects that already have at least one invoice ----------
  const alreadyHas = await db.clientInvoice.findMany({
    where: { projectId: { in: linked.map((p) => p.id) } },
    select: { projectId: true },
  });
  const skipIds = new Set(alreadyHas.map((i) => i.projectId));
  const todo = linked.filter((p) => !skipIds.has(p.id));
  if (skipIds.size > 0) {
    console.log(
      `  ${skipIds.size} already have an invoice (skip).`,
    );
  }
  console.log(`Net to create: ${todo.length}`);

  const totalGrand = todo.reduce(
    (s, p) => s.plus(p.billedValue),
    new Prisma.Decimal(0),
  );
  console.log(`Sum of billed values to invoice: ₹${totalGrand.toFixed(2)}`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — no DB writes. Set IMPORT_CONFIRM=YES to execute.");
    console.log("First 5 to import:");
    for (const p of todo.slice(0, 5)) {
      const m = moneyFromInclusive(p.billedValue);
      console.log(
        `  ${p.code}  ${p.clientName.slice(0, 30).padEnd(30)} ` +
          `grand=₹${p.billedValue.toFixed(2)} sub=₹${m.subtotal.toFixed(2)} ` +
          `cgst=₹${m.cgst.toFixed(2)} sgst=₹${m.sgst.toFixed(2)}`,
      );
    }
    return;
  }

  // ---------- Create invoices ----------
  console.log("\nCreating invoices...");
  let created = 0;
  let failed = 0;
  let n = 1;
  const today = new Date();
  for (const p of todo) {
    const invNo = `IMP-2026-${String(n).padStart(4, "0")}`;
    n++;

    const grand = p.billedValue;
    const { subtotal, taxTotal, cgst, sgst } = moneyFromInclusive(grand);
    const issuedAt = p.poDate ?? today;
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + 30);

    try {
      await db.clientInvoice.create({
        data: {
          invoiceNo: invNo,
          kind: InvoiceKind.ADHOC,
          status: InvoiceStatus.ISSUED,
          projectId: p.id,
          clientId: p.clientId!,
          placeOfSupplyStateCode: "29", // Karnataka — matches default client state
          issuedAt,
          dueAt,
          subtotal,
          cgst,
          sgst,
          igst: new Prisma.Decimal(0),
          taxTotal,
          grandTotal: grand,
          amountPaid: new Prisma.Decimal(0),
          notes: "Imported from projects-2026-04-21.xlsx (Billed Value column)",
          createdById: admin.id,
          shareToken: newShareToken(),
          lines: {
            create: [
              {
                sortOrder: 0,
                description: `Imported billing for ${p.code}`,
                quantity: new Prisma.Decimal(1),
                unit: "lot",
                unitPrice: subtotal,
                discountPct: new Prisma.Decimal(0),
                gstRatePct: new Prisma.Decimal(18),
                lineSubtotal: subtotal,
                lineTax: taxTotal,
                lineTotal: grand,
              },
            ],
          },
        },
      });
      created++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${p.code} (${invNo}): ${msg.slice(0, 200)}`);
    }
  }
  console.log(`\nResult: ${created} created, ${failed} failed.`);

  // ---------- Final tallies ----------
  const totalIssued = await db.clientInvoice.aggregate({
    where: { status: InvoiceStatus.ISSUED },
    _sum: { grandTotal: true },
    _count: { _all: true },
  });
  console.log(
    `\nDB now has ${totalIssued._count._all} ISSUED invoices ` +
      `totalling ₹${(totalIssued._sum.grandTotal ?? 0).toString()}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
