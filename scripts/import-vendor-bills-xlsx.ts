/* eslint-disable no-console */
// One-shot importer for the user's MGPS - Accounts Payable-2026-27.xlsx.
// Reads each per-month sheet (April2026, Feb2026, Aug 2025_Purchase, etc.),
// auto-creates Vendor records for each distinct supplier, and creates one
// VendorBill per row.
//
// Usage:
//   IMPORT_FILE='C:/path/to/MGPS - Accounts Payable-2026-27.xlsx' \
//     DATABASE_URL='<railway-url>' \
//     IMPORT_CONFIRM=YES \
//     npx tsx scripts/import-vendor-bills-xlsx.ts
//
// Without IMPORT_CONFIRM=YES, dry-run only.

import {
  PrismaClient,
  Prisma,
  VendorCategory,
  VendorBillStatus,
  VendorPaymentTerms,
} from "@prisma/client";
import * as XLSX from "xlsx";

const db = new PrismaClient();
const FILE = process.env.IMPORT_FILE
  ?? "C:/Users/LENOVO/OneDrive - SRCA/Desktop/MGPS - Accounts Payable-2026-27.xlsx";
const DRY_RUN = process.env.IMPORT_CONFIRM !== "YES";

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

// "DD.MM.YYYY" → Date, or null.
function parseDDMMYYYY(v: unknown): Date | null {
  const s = trim(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Sheet name → month start. Recognises "April2026", "Feb2026", "Mar26",
// "Aug 2025_Purchase", etc.
const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};
function sheetMonth(name: string): Date | null {
  const lower = name.toLowerCase().replace(/_purchase|\s+/g, "");
  const m = lower.match(/^([a-z]+)(\d{2,4})$/);
  if (!m) return null;
  const [, monStr, yearStr] = m;
  const month = MONTHS[monStr];
  if (month === undefined) return null;
  let y = Number(yearStr);
  if (y < 100) y += 2000;
  return new Date(Date.UTC(y, month, 1));
}

interface BillRow {
  sheet: string;
  rowIdx: number;
  supplier: string;
  purpose: string | null;
  invoiceValue: number;
  pay1: number;
  pay1Date: Date | null;
  pay2: number;
  pay2Date: Date | null;
  pay3: number;
  pay3Date: Date | null;
  totalPaid: number;
  bnfName: string | null;
  beneAccNo: string | null;
  beneIfsc: string | null;
}

async function main() {
  console.log("=== import-vendor-bills-xlsx ===");
  console.log(`FILE:    ${FILE}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(
    `DB:      ${process.env.DATABASE_URL?.replace(/:[^@:]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log();

  const wb = XLSX.readFile(FILE);

  // ---------- Pass 1: parse all rows ----------
  const allRows: BillRow[] = [];
  for (const sheetName of wb.SheetNames) {
    if (sheetName === "Table") continue; // summary sheet
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    const headerIdx = aoa.findIndex(
      (r) => Array.isArray(r) && String(r[0] ?? "").trim() === "S.No",
    );
    if (headerIdx < 0) continue;

    let count = 0;
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!Array.isArray(r)) continue;
      const supplier = trim(r[1]);
      if (!supplier) continue;

      const inv = num(r[4]);
      const totalPaid = num(r[12]);
      if (inv === 0 && totalPaid === 0) continue;

      allRows.push({
        sheet: sheetName,
        rowIdx: i,
        supplier,
        purpose: trim(r[2]),
        invoiceValue: inv,
        pay1: num(r[6]),
        pay1Date: parseDDMMYYYY(r[7]),
        pay2: num(r[8]),
        pay2Date: parseDDMMYYYY(r[9]),
        pay3: num(r[10]),
        pay3Date: parseDDMMYYYY(r[11]),
        totalPaid,
        bnfName: trim(r[13]),
        beneAccNo: trim(r[14]),
        beneIfsc: trim(r[15]),
      });
      count++;
    }
    console.log(`  ${sheetName.padEnd(25)} → ${count} bills`);
  }
  console.log(`Total bills: ${allRows.length}`);

  // ---------- Collect vendors ----------
  const vendorBank = new Map<
    string,
    { bnfName: string | null; beneAccNo: string | null; beneIfsc: string | null }
  >();
  for (const r of allRows) {
    if (r.bnfName || r.beneAccNo || r.beneIfsc) {
      vendorBank.set(r.supplier, {
        bnfName: r.bnfName,
        beneAccNo: r.beneAccNo,
        beneIfsc: r.beneIfsc,
      });
    } else if (!vendorBank.has(r.supplier)) {
      vendorBank.set(r.supplier, { bnfName: null, beneAccNo: null, beneIfsc: null });
    }
  }
  const distinctVendors = [...vendorBank.keys()];
  console.log(`Distinct vendors: ${distinctVendors.length}`);
  console.log(
    `Sum of invoice values: ₹${allRows.reduce((s, r) => s + r.invoiceValue, 0).toFixed(2)}`,
  );
  console.log(
    `Sum of payments: ₹${allRows.reduce((s, r) => s + r.totalPaid, 0).toFixed(2)}`,
  );

  if (DRY_RUN) {
    console.log("\nDRY RUN — no DB writes. Set IMPORT_CONFIRM=YES to execute.");
    return;
  }

  // ---------- Upsert vendors ----------
  console.log("\nUpserting vendors...");
  const vendorIdByName = new Map<string, string>();
  let vCreated = 0;
  let vReused = 0;
  // Find the highest existing V-IMP-NNN code so we don't collide on re-run.
  const existingMax = await db.vendor.findFirst({
    where: { code: { startsWith: "V-IMP-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let nextSeq = existingMax
    ? Number(existingMax.code.replace(/^V-IMP-0*/, "")) + 1
    : 1;

  for (const name of distinctVendors) {
    const existing = await db.vendor.findFirst({ where: { name } });
    if (existing) {
      vendorIdByName.set(name, existing.id);
      vReused++;
      continue;
    }
    const bank = vendorBank.get(name)!;
    const bankParts: string[] = [];
    if (bank.bnfName) bankParts.push(`Bank: ${bank.bnfName}`);
    if (bank.beneAccNo) bankParts.push(`A/C: ${bank.beneAccNo}`);
    if (bank.beneIfsc) bankParts.push(`IFSC: ${bank.beneIfsc}`);
    const notes = bankParts.length
      ? `Imported from MGPS Accounts Payable. ${bankParts.join(" · ")}`
      : "Imported from MGPS Accounts Payable.";

    const code = `V-IMP-${String(nextSeq).padStart(4, "0")}`;
    nextSeq++;
    const created = await db.vendor.create({
      data: {
        code,
        name,
        stateCode: "29",
        category: VendorCategory.OTHER,
        paymentTerms: VendorPaymentTerms.NET_30,
        contactName: bank.bnfName,
        notes,
        active: true,
      },
      select: { id: true },
    });
    vendorIdByName.set(name, created.id);
    vCreated++;
  }
  console.log(`  Vendors: ${vCreated} created, ${vReused} reused.`);

  // ---------- Create vendor bills ----------
  console.log("\nCreating vendor bills...");
  // Find the highest existing VB-IMP-NNNN to avoid collisions on re-run.
  const lastBill = await db.vendorBill.findFirst({
    where: { billNo: { startsWith: "VB-IMP-" } },
    orderBy: { billNo: "desc" },
    select: { billNo: true },
  });
  let billSeq = lastBill
    ? Number(lastBill.billNo.replace(/^VB-IMP-0*/, "")) + 1
    : 1;

  let bCreated = 0;
  let bFailed = 0;
  for (const r of allRows) {
    const billNo = `VB-IMP-${String(billSeq).padStart(4, "0")}`;
    billSeq++;
    const issueDate = sheetMonth(r.sheet) ?? new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const grand = new Prisma.Decimal(r.invoiceValue);
    const paid = new Prisma.Decimal(r.totalPaid);
    // Status: PAID if fully paid (capped — sometimes paid > grand from
    // settling previous balance, treat that as PAID).
    const status =
      r.totalPaid >= r.invoiceValue && r.invoiceValue > 0
        ? VendorBillStatus.PAID
        : VendorBillStatus.APPROVED;
    // paidAt: latest of the three payment dates if status=PAID
    const dates = [r.pay1Date, r.pay2Date, r.pay3Date].filter(
      (d): d is Date => d !== null,
    );
    const paidAt =
      status === VendorBillStatus.PAID && dates.length
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;

    const noteParts: string[] = [`Imported from sheet "${r.sheet}"`];
    if (r.purpose) noteParts.push(`Purpose: ${r.purpose}`);
    const payNotes: string[] = [];
    if (r.pay1 > 0)
      payNotes.push(`Pay1 ₹${r.pay1}${r.pay1Date ? ` on ${r.pay1Date.toISOString().slice(0, 10)}` : ""}`);
    if (r.pay2 > 0)
      payNotes.push(`Pay2 ₹${r.pay2}${r.pay2Date ? ` on ${r.pay2Date.toISOString().slice(0, 10)}` : ""}`);
    if (r.pay3 > 0)
      payNotes.push(`Pay3 ₹${r.pay3}${r.pay3Date ? ` on ${r.pay3Date.toISOString().slice(0, 10)}` : ""}`);
    if (payNotes.length) noteParts.push(payNotes.join(" · "));

    try {
      await db.vendorBill.create({
        data: {
          billNo,
          vendorId: vendorIdByName.get(r.supplier)!,
          status,
          issueDate,
          dueDate,
          subtotal: grand, // unknown GST split → put it all in subtotal
          taxTotal: new Prisma.Decimal(0),
          grandTotal: grand,
          amountPaid: paid,
          paidAt,
          notes: noteParts.join(". "),
        },
      });
      bCreated++;
    } catch (err) {
      bFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${billNo} (${r.supplier}): ${msg.slice(0, 200)}`);
    }
  }
  console.log(`  Vendor bills: ${bCreated} created, ${bFailed} failed.`);

  // ---------- Final tallies ----------
  const finalVendors = await db.vendor.count();
  const finalBills = await db.vendorBill.count();
  console.log(`\nDB now has ${finalVendors} vendors, ${finalBills} vendor bills.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
