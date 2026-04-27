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

  const rows: AprilRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!Array.isArray(r)) continue;
    const supplier = trim(r[1]);
    if (!supplier) continue;
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

  // ---------- Create one VendorBill per row with Invoice Value > 0 ----------
  console.log("\nCreating vendor bills (one per row with invoice > 0)...");
  let billsCreated = 0;
  let billsFailed = 0;
  let billSeq = 1;
  for (const [name, r] of byVendor) {
    if (r.invoiceValue <= 0) continue;

    const billNo = `VB-IMP-${String(billSeq).padStart(4, "0")}`;
    billSeq++;
    const grand = new Prisma.Decimal(r.invoiceValue);
    // Cap amountPaid at grandTotal — any excess paid against this vendor in
    // April was settling opening balance, not this month's invoice.
    const paidAgainstThisBill = Math.min(r.totalPaid, r.invoiceValue);
    const paid = new Prisma.Decimal(paidAgainstThisBill);

    const status =
      paidAgainstThisBill >= r.invoiceValue
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
    if (r.totalPaid > r.invoiceValue) {
      noteParts.push(
        `Note: Total Apr payment ${inr(r.totalPaid)} exceeded this invoice; excess ${inr(r.totalPaid - r.invoiceValue)} settled opening balance (see vendor notes)`,
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
      billsCreated++;
    } catch (err) {
      billsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${billNo} (${name}): ${msg.slice(0, 200)}`);
    }
  }
  console.log(`  Vendor bills: ${billsCreated} created, ${billsFailed} failed.`);

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
