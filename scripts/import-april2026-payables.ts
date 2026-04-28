/* eslint-disable no-console */
// April 2026 Accounts-Payable importer.
//
// One sheet ("April2026") -> one Vendor row per supplier + one VendorBill
// per row that had a non-zero "Invoice Value" (the actual April purchases).
//
// The "Previous Balance" column in the spreadsheet is a hardcoded
// per-vendor opening balance carried over from prior periods. The schema
// has no opening-balance field, so we capture it as a structured snapshot
// in Vendor.notes alongside the closing-balance math:
//
//   Opening balance (1 Apr 2026): ₹X
//   Apr invoice:                  ₹Y
//   Apr payments:                 ₹Z
//   Closing balance (30 Apr):     ₹X + Y - Z
//   Bank: BNF / A/C / IFSC
//
// Bill amountPaid is capped at grandTotal — if the supplier was paid more
// than this month's invoice, the excess settles opening balance and is
// reflected in the vendor-notes summary, not on the bill itself (the bill
// represents only the April purchase).
//
// Usage:
//   IMPORT_FILE='C:/path/to/MGPS - Accounts Payable-2026-27.xlsx' \
//     DATABASE_URL='<railway-url>' \
//     IMPORT_CONFIRM=YES \
//     npx tsx scripts/import-april2026-payables.ts

import {
  PrismaClient,
  Prisma,
  VendorCategory,
  VendorBillStatus,
  VendorPaymentTerms,
} from "@prisma/client";
import * as XLSX from "xlsx";

const db = new PrismaClient();
const FILE =
  process.env.IMPORT_FILE ??
  "C:/Users/LENOVO/OneDrive - SRCA/Desktop/MGPS - Accounts Payable-2026-27.xlsx";
const SHEET = "April2026";
const DRY_RUN = process.env.IMPORT_CONFIRM !== "YES";

// Period anchor — the spreadsheet represents Apr 2026 (Indian FY 26-27).
const APR_START = new Date(Date.UTC(2026, 3, 1)); // 1 Apr 2026 UTC
const APR_END = new Date(Date.UTC(2026, 3, 30)); // 30 Apr 2026 UTC

// ---------- Helpers ----------
const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.replace(/,/g, "").trim();
    if (!s || s === "#REF!") return 0;
    return Number(s) || 0;
  }
  return 0;
};

const trim = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "#REF!" || s === "—") return null;
  return s;
};

function parseDDMMYYYY(v: unknown): Date | null {
  const s = trim(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const inr = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface AprilRow {
  supplier: string;
  purpose: string | null;
  opening: number; // Previous Balance
  invoiceValue: number;
  pay1: number;
  pay1Date: Date | null;
  pay2: number;
  pay2Date: Date | null;
  pay3: number;
  pay3Date: Date | null;
  totalPaid: number;
  closingFromSheet: number; // Balance Due column (their math)
  bnfName: string | null;
  beneAccNo: string | null;
  beneIfsc: string | null;
}

async function main() {
  console.log("=== import-april2026-payables ===");
  console.log(`FILE:    ${FILE}`);
  console.log(`SHEET:   ${SHEET}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(
    `DB:      ${process.env.DATABASE_URL?.replace(/:[^@:]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log();

  // ---------- Read sheet ----------
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    console.error(`FATAL: sheet "${SHEET}" not found.`);
    process.exit(1);
  }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  });
  const headerIdx = aoa.findIndex(
    (r) => Array.isArray(r) && String(r[0] ?? "").trim() === "S.No",
  );
  if (headerIdx < 0) {
    console.error(`FATAL: header row "S.No" not found in sheet.`);
    process.exit(1);
  }

  // Words / phrases that mean "this row is a footer / aggregate, not a real
  // supplier". The April 2026 sheet has a "Total" row near the bottom whose
  // column F is the SUM formula of every preceding row — if we don't skip
  // it, every running total gets doubled.
  const FOOTER_RE = /^(total|grand\s*total|subtotal|sum|footer)$/i;

  const rows: AprilRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!Array.isArray(r)) continue;
    const supplier = trim(r[1]);
    if (!supplier) continue;
    if (FOOTER_RE.test(supplier)) {
      console.log(`  Skipping footer/totals row at sheet row ${i + 1}: "${supplier}"`);
      continue;
    }
    rows.push({
      supplier,
      purpose: trim(r[2]),
      opening: num(r[3]),
      invoiceValue: num(r[4]),
      pay1: num(r[6]),
      pay1Date: parseDDMMYYYY(r[7]),
      pay2: num(r[8]),
      pay2Date: parseDDMMYYYY(r[9]),
      pay3: num(r[10]),
      pay3Date: parseDDMMYYYY(r[11]),
      totalPaid: num(r[12]),
      closingFromSheet: num(r[5]),
      bnfName: trim(r[13]),
      beneAccNo: trim(r[14]),
      beneIfsc: trim(r[15]),
    });
  }
  console.log(`Rows in April 2026: ${rows.length}`);

  // ---------- Aggregate per supplier (de-duplicate if any) ----------
  const byVendor = new Map<string, AprilRow>();
  let dupes = 0;
  for (const r of rows) {
    if (byVendor.has(r.supplier)) {
      // Same supplier appearing twice in one sheet — sum amounts.
      const prev = byVendor.get(r.supplier)!;
      byVendor.set(r.supplier, {
        ...prev,
        invoiceValue: prev.invoiceValue + r.invoiceValue,
        pay1: prev.pay1 + r.pay1,
        pay2: prev.pay2 + r.pay2,
        pay3: prev.pay3 + r.pay3,
        totalPaid: prev.totalPaid + r.totalPaid,
      });
      dupes++;
    } else {
      byVendor.set(r.supplier, r);
    }
  }
  if (dupes > 0) console.log(`(merged ${dupes} duplicate-supplier rows)`);

  // ---------- Totals ----------
  const totalOpening = rows.reduce((s, r) => s + r.opening, 0);
  const totalInvoice = rows.reduce((s, r) => s + r.invoiceValue, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
  const totalClosing = totalOpening + totalInvoice - totalPaid;
  console.log(`Distinct vendors:   ${byVendor.size}`);
  console.log(`Total opening:      ${inr(totalOpening)}`);
  console.log(`Total Apr invoice:  ${inr(totalInvoice)}`);
  console.log(`Total Apr payments: ${inr(totalPaid)}`);
  console.log(`Total closing:      ${inr(totalClosing)}`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — no DB writes. Set IMPORT_CONFIRM=YES to execute.");
    console.log("\nFirst 5 vendors (preview):");
    [...byVendor.values()].slice(0, 5).forEach((r) => {
      const closing = r.opening + r.invoiceValue - r.totalPaid;
      console.log(
        `  ${r.supplier.slice(0, 40).padEnd(40)} ` +
          `open=${inr(r.opening).padStart(15)} ` +
          `inv=${inr(r.invoiceValue).padStart(13)} ` +
          `paid=${inr(r.totalPaid).padStart(13)} ` +
          `→ close=${inr(closing).padStart(15)}`,
      );
    });
    return;
  }

  // ---------- Create vendors ----------
  console.log("\nCreating vendors...");
  const vendorIdByName = new Map<string, string>();
  let nextSeq = 1;
  for (const [name, r] of byVendor) {
    const closing = r.opening + r.invoiceValue - r.totalPaid;
    const noteLines: string[] = [
      `Opening balance (1 Apr 2026): ${inr(r.opening)}`,
      `Apr 2026 invoice:             ${inr(r.invoiceValue)}`,
      `Apr 2026 payments:            ${inr(r.totalPaid)}`,
      `Closing balance (30 Apr):     ${inr(closing)}`,
    ];
    if (r.purpose) noteLines.push(`Purpose: ${r.purpose}`);
    if (r.bnfName) noteLines.push(`Bank: ${r.bnfName}`);
    if (r.beneAccNo) noteLines.push(`A/C: ${r.beneAccNo}`);
    if (r.beneIfsc) noteLines.push(`IFSC: ${r.beneIfsc}`);
    const notes = noteLines.join("\n");

    const code = `V-IMP-${String(nextSeq).padStart(4, "0")}`;
    nextSeq++;
    const created = await db.vendor.create({
      data: {
        code,
        name,
        stateCode: "29",
        category: VendorCategory.OTHER,
        paymentTerms: VendorPaymentTerms.NET_30,
        contactName: r.bnfName,
        notes,
        active: true,
      },
      select: { id: true },
    });
    vendorIdByName.set(name, created.id);
  }
  console.log(`  Created ${vendorIdByName.size} vendors.`);

  // ---------- Create vendor bills ----------
  // Two bills per vendor (when applicable) so the dashboard's Outstanding
  // KPI sums correctly:
  //   1. "Opening balance carry-forward" bill, dated 31 Mar 2026, with
  //      grandTotal = positive opening balance. amountPaid = April payment
  //      that exceeded the April invoice (those excess rupees settled
  //      opening, not the current month).
  //   2. "April 2026 invoice" bill, dated 1 Apr 2026, with grandTotal =
  //      Invoice Value and amountPaid capped at the invoice amount.
  //
  // Vendors with negative opening balance (we have credit with them) get
  // no carry-forward bill — the credit is recorded only in vendor notes.
  // The dashboard would otherwise need a "credit memo" entity, which the
  // schema doesn't model.
  const OB_ISSUE = new Date(Date.UTC(2026, 2, 31)); // 31 Mar 2026
  const OB_DUE = new Date(Date.UTC(2026, 3, 30)); // due 30 Apr (with the rest)

  console.log("\nCreating vendor bills (opening + April invoices + credits)...");
  let openingBillsCreated = 0;
  let aprBillsCreated = 0;
  let creditBillsCreated = 0;
  let billsFailed = 0;
  let obSeq = 1;
  let aprSeq = 1;
  let crSeq = 1;
  for (const [name, r] of byVendor) {
    // -- Allocate the April payment between April invoice and opening --
    const paidVsApril = Math.min(r.totalPaid, r.invoiceValue);
    const paidVsOpening =
      r.opening > 0 ? Math.min(r.totalPaid - paidVsApril, r.opening) : 0;

    // -- Bill 0: Vendor-credit carry-forward (only if opening < 0) --
    // Modelled as a NEGATIVE-grandTotal bill so it subtracts from the
    // vendor's Outstanding KPI. Schema allows negative Decimal values;
    // the dashboard sums (grandTotal - amountPaid) and a negative bill
    // simply offsets positive ones.
    //
    // Excess April payment beyond the April invoice goes onto this
    // bill's amountPaid as a POSITIVE number. That makes
    // (grandTotal - amountPaid) = (-X) - (+Y) = -(X+Y), i.e. the
    // credit GROWS by the over-payment — which matches what happens
    // in real accounting (more pre-payment held with the vendor).
    if (r.opening < 0) {
      const crNo = `CR-IMP-${String(crSeq).padStart(4, "0")}`;
      crSeq++;
      const grand = new Prisma.Decimal(r.opening); // negative
      // For vendors with negative opening, any excess April payment
      // increases the credit balance (deepens the negative).
      const excess = Math.max(0, r.totalPaid - r.invoiceValue);
      const paid = new Prisma.Decimal(excess);
      const crNotes = [
        "Vendor credit carry-forward as of 1 Apr 2026",
        `We overpaid this supplier by ${inr(Math.abs(r.opening))} in prior periods`,
        excess > 0
          ? `April additional pre-payment: ${inr(excess)} (deepens credit)`
          : "No additional April activity against credit",
        "This negative-balance bill reduces the vendor's Outstanding KPI",
      ].join(". ");
      try {
        await db.vendorBill.create({
          data: {
            billNo: crNo,
            vendorId: vendorIdByName.get(name)!,
            status: VendorBillStatus.APPROVED,
            issueDate: OB_ISSUE,
            dueDate: OB_DUE,
            subtotal: grand,
            taxTotal: new Prisma.Decimal(0),
            grandTotal: grand,
            amountPaid: paid,
            paidAt: null,
            notes: crNotes,
          },
        });
        creditBillsCreated++;
      } catch (err) {
        billsFailed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAIL ${crNo} (${name}, credit): ${msg.slice(0, 200)}`);
      }
    }

    // -- Bill 1: Opening balance carry-forward (only if opening > 0) --
    if (r.opening > 0) {
      const obNo = `OB-IMP-${String(obSeq).padStart(4, "0")}`;
      obSeq++;
      const grand = new Prisma.Decimal(r.opening);
      const paid = new Prisma.Decimal(paidVsOpening);
      const status =
        paidVsOpening >= r.opening
          ? VendorBillStatus.PAID
          : VendorBillStatus.APPROVED;

      const dates = [r.pay1Date, r.pay2Date, r.pay3Date].filter(
        (d): d is Date => d !== null,
      );
      const paidAt =
        status === VendorBillStatus.PAID && dates.length
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : null;

      const obNotes = [
        `Opening balance carry-forward as of 1 Apr 2026`,
        `Aggregate of unpaid bills from prior periods (FY 25-26 and earlier)`,
        paidVsOpening > 0
          ? `April payment applied: ${inr(paidVsOpening)}`
          : `No payment applied in April`,
      ].join(". ");

      try {
        await db.vendorBill.create({
          data: {
            billNo: obNo,
            vendorId: vendorIdByName.get(name)!,
            status,
            issueDate: OB_ISSUE,
            dueDate: OB_DUE,
            subtotal: grand,
            taxTotal: new Prisma.Decimal(0),
            grandTotal: grand,
            amountPaid: paid,
            paidAt,
            notes: obNotes,
          },
        });
        openingBillsCreated++;
      } catch (err) {
        billsFailed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAIL ${obNo} (${name}, opening): ${msg.slice(0, 200)}`);
      }
    }

    // -- Bill 2: April 2026 invoice (only if invoiceValue > 0) --
    // Wrapped in a block (not `continue`) so the over-payment check at
    // the bottom of the loop still fires for vendors with invoice = 0.
    if (r.invoiceValue > 0) {
      const billNo = `VB-IMP-${String(aprSeq).padStart(4, "0")}`;
    aprSeq++;
    const grand = new Prisma.Decimal(r.invoiceValue);
    const paid = new Prisma.Decimal(paidVsApril);

    const status =
      paidVsApril >= r.invoiceValue
        ? VendorBillStatus.PAID
        : VendorBillStatus.APPROVED;

    const dates = [r.pay1Date, r.pay2Date, r.pay3Date].filter(
      (d): d is Date => d !== null,
    );
    const paidAt =
      status === VendorBillStatus.PAID && dates.length
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;

    const noteParts: string[] = ["Apr 2026 invoice"];
    if (r.purpose) noteParts.push(`Purpose: ${r.purpose}`);
    const payNotes: string[] = [];
    if (r.pay1 > 0)
      payNotes.push(
        `Pay1 ${inr(r.pay1)}${r.pay1Date ? ` on ${r.pay1Date.toISOString().slice(0, 10)}` : ""}`,
      );
    if (r.pay2 > 0)
      payNotes.push(
        `Pay2 ${inr(r.pay2)}${r.pay2Date ? ` on ${r.pay2Date.toISOString().slice(0, 10)}` : ""}`,
      );
    if (r.pay3 > 0)
      payNotes.push(
        `Pay3 ${inr(r.pay3)}${r.pay3Date ? ` on ${r.pay3Date.toISOString().slice(0, 10)}` : ""}`,
      );
    if (payNotes.length) noteParts.push(payNotes.join(" · "));
    if (paidVsOpening > 0) {
      noteParts.push(
        `Note: ${inr(paidVsOpening)} of the Apr payment was allocated to the opening-balance bill instead`,
      );
    }

    try {
      await db.vendorBill.create({
        data: {
          billNo,
          vendorId: vendorIdByName.get(name)!,
          status,
          issueDate: APR_START,
          dueDate: APR_END,
          subtotal: grand,
          taxTotal: new Prisma.Decimal(0),
          grandTotal: grand,
          amountPaid: paid,
          paidAt,
          notes: noteParts.join(". "),
        },
      });
      aprBillsCreated++;
      } catch (err) {
        billsFailed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAIL ${billNo} (${name}, apr): ${msg.slice(0, 200)}`);
      }
    } // end of `if (r.invoiceValue > 0)` block

    // -- Bill 3: Over-payment credit (only when totalPaid > opening + invoice
    //    AND opening was non-negative). The leftover after fully paying both
    //    the opening and April bills represents pre-payment / advance against
    //    future invoices. Same negative-grandTotal trick as the carry-forward
    //    credit, so the dashboard's outstanding sums to the correct closing
    //    balance (which would be negative for these vendors). --
    if (r.opening >= 0) {
      const allocated = paidVsApril + paidVsOpening;
      const overflow = r.totalPaid - allocated;
      if (overflow > 0.005) {
        const crNo = `CR-IMP-${String(crSeq).padStart(4, "0")}`;
        crSeq++;
        try {
          await db.vendorBill.create({
            data: {
              billNo: crNo,
              vendorId: vendorIdByName.get(name)!,
              status: VendorBillStatus.APPROVED,
              issueDate: APR_END,
              dueDate: APR_END,
              subtotal: new Prisma.Decimal(-overflow),
              taxTotal: new Prisma.Decimal(0),
              grandTotal: new Prisma.Decimal(-overflow),
              amountPaid: new Prisma.Decimal(0),
              paidAt: null,
              notes: [
                "Over-payment credit (Apr 2026)",
                `Vendor was paid ${inr(overflow)} more than opening + April invoice combined`,
                "Treat as advance for future invoices; reduces vendor's outstanding",
              ].join(". "),
            },
          });
          creditBillsCreated++;
        } catch (err) {
          billsFailed++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  FAIL ${crNo} (${name}, overflow): ${msg.slice(0, 200)}`);
        }
      }
    }
  }
  console.log(
    `  Credit bills: ${creditBillsCreated} | Opening-balance bills: ${openingBillsCreated} | April invoice bills: ${aprBillsCreated} | failed: ${billsFailed}`,
  );

  // ---------- Final summary ----------
  console.log("\nFinal DB state:");
  const v = await db.vendor.count();
  const b = await db.vendorBill.aggregate({
    _count: { _all: true },
    _sum: { grandTotal: true, amountPaid: true },
  });
  console.log(`  Vendors:              ${v}`);
  console.log(`  Vendor bills:         ${b._count._all}`);
  console.log(`  Sum grandTotal:       ${inr(Number(b._sum.grandTotal ?? 0))}`);
  console.log(`  Sum amountPaid:       ${inr(Number(b._sum.amountPaid ?? 0))}`);
  console.log(`  Sum opening balance:  ${inr(totalOpening)} (in vendor notes)`);
  console.log(`  Sum closing balance:  ${inr(totalClosing)} (in vendor notes)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
