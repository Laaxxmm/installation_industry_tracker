/* eslint-disable no-console */
// Imports the "Stock Format.xlsx" into the Material table.
// Each row → one Material row with:
//   sku         = "STK-" + zero-padded Sl.No
//   name        = col "Stock Name" trimmed
//   unit        = col "Unit" trimmed (defaults to "PCS")
//   onHandQty   = col "Stock Nos" (0 if blank)
//   avgUnitCost = col "PRICE"     (0 if blank)
//   active      = true
// Idempotent: re-running upserts by sku.
//
// Usage: node scripts/import-stock-format.mjs
//        node scripts/import-stock-format.mjs --dry   (preview only)

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const FILE =
  "C:/Users/LENOVO/Desktop/Kishore Desktop/OThers/SAB MGPS/PO/Stock Format.xlsx";

const db = new PrismaClient();

function cellText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("formula" in v) return String(v.result ?? v.formula);
    if ("hyperlink" in v) return String(v.text ?? v.hyperlink);
    return JSON.stringify(v);
  }
  return String(v);
}

function num(v) {
  const s = cellText(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const dry = process.argv.includes("--dry");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No sheet found");

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const slnoRaw = cellText(row.getCell(1)).trim();
    const name = cellText(row.getCell(2)).trim();
    const unit = cellText(row.getCell(3)).trim() || "PCS";
    const qty = num(row.getCell(4).value);
    const price = num(row.getCell(5).value);

    if (!slnoRaw || !name) continue;
    const slno = Number(slnoRaw);
    if (!Number.isFinite(slno)) continue;

    const sku = `STK-${String(slno).padStart(4, "0")}`;
    rows.push({ sku, name, unit, qty, price });
  }

  console.log(`Parsed ${rows.length} stock rows from Excel.`);
  const dupNames = new Map();
  for (const r of rows) dupNames.set(r.name, (dupNames.get(r.name) ?? 0) + 1);
  const dupes = [...dupNames.entries()].filter(([, n]) => n > 1);
  if (dupes.length) {
    console.log(
      `Note: ${dupes.length} stock name(s) appear more than once in the sheet; each gets its own SKU by Sl.No.`,
    );
  }

  if (dry) {
    console.log("\nFirst 10 rows preview:");
    for (const r of rows.slice(0, 10)) {
      console.log(`  ${r.sku}  ${r.name.padEnd(40)} ${r.unit}  qty=${r.qty}  @${r.price}`);
    }
    console.log("... (dry run, no DB writes)");
    return;
  }

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const existing = await db.material.findUnique({ where: { sku: r.sku } });
    await db.material.upsert({
      where: { sku: r.sku },
      create: {
        sku: r.sku,
        name: r.name,
        unit: r.unit,
        onHandQty: r.qty,
        avgUnitCost: r.price,
        active: true,
      },
      update: {
        name: r.name,
        unit: r.unit,
        onHandQty: r.qty,
        avgUnitCost: r.price,
        active: true,
      },
    });
    if (existing) updated++;
    else created++;
  }

  const totalValue = rows.reduce((a, r) => a + r.qty * r.price, 0);
  console.log(`\n✓ Done.`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(
    `  Inventory book value (qty × price): ₹${totalValue.toLocaleString(
      "en-IN",
      { maximumFractionDigits: 2 },
    )}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
