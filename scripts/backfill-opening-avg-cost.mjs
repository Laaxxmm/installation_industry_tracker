/* eslint-disable no-console */
// Reads Stock Format.xlsx and sets Material.openingAvgCost = PRICE column
// (matched by sku = "STK-" + padded Sl.No). Safe to re-run.

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
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No sheet");

  let updated = 0;
  let skipped = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const slnoRaw = cellText(row.getCell(1)).trim();
    const price = num(row.getCell(5).value);
    if (!slnoRaw) continue;
    const slno = Number(slnoRaw);
    if (!Number.isFinite(slno)) continue;
    const sku = `STK-${String(slno).padStart(4, "0")}`;
    const mat = await db.material.findUnique({ where: { sku } });
    if (!mat) {
      skipped++;
      continue;
    }
    await db.material.update({
      where: { id: mat.id },
      data: { openingAvgCost: price.toFixed(4) },
    });
    updated++;
  }
  console.log(`Updated ${updated} materials, skipped ${skipped} (no sku match).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
