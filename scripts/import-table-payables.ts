/* eslint-disable no-console */
// Imports the operator's authoritative Accounts Payable view from the
// "Table" sheet of MGPS - Accounts Payable-2026-27.xlsx. Each row in
// that sheet is one supplier with the cumulative state across all months:
//   Previous Balance + Invoice Value - Total Payment = Balance Due
//
// Unlike the per-month sheets, this is the LATEST current state — what
// the user actually owes as of today. Each vendor gets one bill whose
// outstanding amount equals their Balance Due column:
//
//   - Balance Due > 0  → "Outstanding payable" bill (grandTotal = Balance Due)
//   - Balance Due < 0  → "Vendor credit"      bill (grandTotal = Balance Due, negative)
//   - Balance Due = 0  → No bill, just the vendor record
//
// The breakdown columns (Previous Balance, Invoice Value, Total Payment)
// are cumulative across many months and can't be cleanly mapped to single
// invoice/payment records — they're recorded in Vendor.notes for reference.
//
// Usage:
//   IMPORT_FILE='C:/path/to/MGPS - Accounts Payable-2026-27.xlsx' \
//     DATABASE_URL='<railway-url>' \
//     IMPORT_CONFIRM=YES \
//     npx tsx scripts/import-table-payables.ts

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
const SHEET = "Table";
const DRY_RUN = process.env.IMPORT_CONFIRM !== "YES";

// As-of date for the imported balances. Use today since the Table sheet
// is the live cumulative state.
const AS_OF = new Date();

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

const inr = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface TableRow {
  supplier: string;
  previousBalance: number;
  invoiceValue: number;
  totalPayment: number;
  balanceDue: number;
}

async function main() {
  console.log("=== import-table-payables ===");
  console.log(`FILE:    ${FILE}`);
  console.log(`SHEET:   ${SHEET}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(
    `DB:      ${process.env.DATABASE_URL?.replace(/:[^@:]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log();

  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    console.error(`FATAL: sheet "${SHEET}" not found.`);
    process.exit(1);
  }
  type Row = Record<string, unknown>;
  const allRows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });

  const rows: TableRow[] = [];
  for (const r of allRows) {
    const supplier = trim(r["Supplier Name"]);
    if (!supplier) continue;
    rows.push({
      supplier,
      previousBalance: num(r["Previous Balance"]),
      invoiceValue: num(r["Invoice Value"]),
      totalPayment: num(r["Total     Payment"]),
      balanceDue: num(r["Balance Due"]),
    });
  }

  // Aggregate duplicate supplier names defensively (sum the same way the
  // sheet's own totals do).
  const byVendor = new Map<string, TableRow>();
  for (const r of rows) {
    const existing = byVendor.get(r.supplier);
    if (existing) {
      byVendor.set(r.supplier, {
        supplier: r.supplier,
        previousBalance: existing.previousBalance + r.previousBalance,
        invoiceValue: existing.invoiceValue + r.invoiceValue,
        totalPayment: existing.totalPayment + r.totalPayment,
        balanceDue: existing.balanceDue + r.balanceDue,
      });
    } else {
      byVendor.set(r.supplier, r);
    }
  }
  console.log(`Rows:                ${rows.length}`);
  console.log(`Distinct vendors:    ${byVendor.size}`);

  const totalPrev = [...byVendor.values()].reduce((s, r) => s + r.previousBalance, 0);
  const totalInv = [...byVendor.values()].reduce((s, r) => s + r.invoiceValue, 0);
  const totalPay = [...byVendor.values()].reduce((s, r) => s + r.totalPayment, 0);
  const totalDue = [...byVendor.values()].reduce((s, r) => s + r.balanceDue, 0);

  console.log(`Sum Previous Balance: ${inr(totalPrev)}`);
  console.log(`Sum Invoice Value:    ${inr(totalInv)}`);
  console.log(`Sum Total Payment:    ${inr(totalPay)}`);
  console.log(`Sum Balance Due:      ${inr(totalDue)}  ← target dashboard total`);

  const positives = [...byVendor.values()].filter((r) => r.balanceDue > 0);
  const negatives = [...byVendor.values()].filter((r) => r.balanceDue < 0);
  const zeros = [...byVendor.values()].filter((r) => r.balanceDue === 0);
  console.log(
    `\nBreakdown: ${positives.length} owed, ${negatives.length} credit, ${zeros.length} zero-balance`,
  );

  if (DRY_RUN) {
    console.log(
      "\nDRY RUN — no DB writes. Set IMPORT_CONFIRM=YES to execute.",
    );
    return;
  }

  // ---------- Create vendors ----------
  console.log("\nCreating vendors...");
  const vendorIdByName = new Map<string, string>();
  let vSeq = 1;
  for (const [name, r] of byVendor) {
    const noteLines = [
      `Imported from Table sheet (cumulative state as of ${AS_OF.toISOString().slice(0, 10)})`,
      `Previous Balance: ${inr(r.previousBalance)}`,
      `Cumulative invoice value: ${inr(r.invoiceValue)}`,
      `Cumulative payments:      ${inr(r.totalPayment)}`,
      `Current Balance Due:      ${inr(r.balanceDue)}`,
    ];

    const code = `V-IMP-${String(vSeq).padStart(4, "0")}`;
    vSeq++;
    const created = await db.vendor.create({
      data: {
        code,
        name,
        stateCode: "29",
        category: VendorCategory.OTHER,
        paymentTerms: VendorPaymentTerms.NET_30,
        notes: noteLines.join("\n"),
        active: true,
      },
      select: { id: true },
    });
    vendorIdByName.set(name, created.id);
  }
  console.log(`  Vendors created: ${vendorIdByName.size}`);

  // ---------- Create one bill per non-zero balance ----------
  console.log("\nCreating outstanding-balance bills...");
  let billsCreated = 0;
  let billsFailed = 0;
  let oseq = 1; // outstanding sequence
  let cseq = 1; // credit sequence
  for (const [name, r] of byVendor) {
    if (r.balanceDue === 0) continue;

    const isCredit = r.balanceDue < 0;
    const billNo = isCredit
      ? `CR-IMP-${String(cseq++).padStart(4, "0")}`
      : `OB-IMP-${String(oseq++).padStart(4, "0")}`;

    const grand = new Prisma.Decimal(r.balanceDue);
    const notes = isCredit
      ? `Vendor credit (we have a credit balance with this supplier as of ${AS_OF.toISOString().slice(0, 10)}). Negative grandTotal so the dashboard's outstanding-payables KPI reduces by this amount.`
      : `Outstanding payable as of ${AS_OF.toISOString().slice(0, 10)}. Cumulative balance carried over from the operator's Accounts Payable Excel ("Table" sheet, Balance Due column). Breakdown is in vendor notes — Previous Balance + Invoice Value - Total Payment = this Balance Due.`;

    try {
      await db.vendorBill.create({
        data: {
          billNo,
          vendorId: vendorIdByName.get(name)!,
          status: VendorBillStatus.APPROVED,
          issueDate: AS_OF,
          dueDate: AS_OF,
          subtotal: grand,
          taxTotal: new Prisma.Decimal(0),
          grandTotal: grand,
          amountPaid: new Prisma.Decimal(0),
          paidAt: null,
          notes,
        },
      });
      billsCreated++;
    } catch (err) {
      billsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${billNo} (${name}): ${msg.slice(0, 200)}`);
    }
  }
  console.log(`  Bills: ${billsCreated} created, ${billsFailed} failed.`);

  // ---------- Final reconciliation ----------
  console.log("\nFinal DB state:");
  const v = await db.vendor.count();
  const b = await db.vendorBill.aggregate({
    _count: { _all: true },
    _sum: { grandTotal: true, amountPaid: true },
  });
  const grand = Number(b._sum.grandTotal ?? 0);
  const paid = Number(b._sum.amountPaid ?? 0);
  console.log(`  Vendors:           ${v}`);
  console.log(`  Vendor bills:      ${b._count._all}`);
  console.log(`  Sum grandTotal:    ${inr(grand)}`);
  console.log(`  Sum amountPaid:    ${inr(paid)}`);
  console.log(`  Sum outstanding:   ${inr(grand - paid)}`);
  console.log(`  Spreadsheet target: ${inr(totalDue)}`);
  console.log(`  Diff:              ${inr(grand - paid - totalDue)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
