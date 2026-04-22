/* eslint-disable no-console */
// Imports "Materials Supplied.xlsx" into Project.materialsSupplied.
// Col A = PO NO (matches Project.poNumber string), Col B = Materials Consumed (rupees).
// Only rows with a non-empty value are imported. Match is by normalized PO string
// (trim + collapse whitespace + case-insensitive).
//
// Usage:
//   node scripts/import-materials-supplied.mjs           (applies updates)
//   node scripts/import-materials-supplied.mjs --dry     (preview only)

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const FILE =
  "C:/Users/LENOVO/Desktop/Kishore Desktop/OThers/SAB MGPS/PO/Materials Supplied.xlsx";

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
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normPo(s) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

async function main() {
  const dry = process.argv.includes("--dry");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No sheet found");

  // The Excel is ordered such that row N corresponds to project code
  // SAB-2026-<padded N-1>. For ambiguous PO strings (VERBAL ORDER, Waiting PO),
  // we fall back to this positional match.
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const po = cellText(row.getCell(1).value).trim();
    const val = num(row.getCell(2).value);
    if (!po || val === null) continue;
    const positionalCode = `SAB-2026-${String(r - 1).padStart(4, "0")}`;
    rows.push({ excelRow: r, po, val, positionalCode });
  }
  console.log(`Parsed ${rows.length} rows with values from Excel.`);

  const projects = await db.project.findMany({
    select: { id: true, code: true, poNumber: true },
  });
  const byCode = new Map(projects.map((p) => [p.code, p]));
  const byNormPo = new Map();
  for (const p of projects) {
    if (!p.poNumber) continue;
    const k = normPo(p.poNumber);
    if (!byNormPo.has(k)) byNormPo.set(k, []);
    byNormPo.get(k).push(p);
  }

  const matched = [];
  const ambiguous = [];
  const missing = [];
  for (const r of rows) {
    const hits = byNormPo.get(normPo(r.po)) ?? [];
    if (hits.length === 1) {
      matched.push({ ...r, project: hits[0], via: "po" });
      continue;
    }
    // Ambiguous or no match — try positional match by row index → SAB-2026-NNNN.
    const positional = byCode.get(r.positionalCode);
    if (positional && (hits.length === 0 || hits.some((h) => h.id === positional.id))) {
      matched.push({ ...r, project: positional, via: "position" });
    } else if (hits.length === 0) {
      missing.push(r);
    } else {
      ambiguous.push({ ...r, hits });
    }
  }

  console.log(`  Matched:   ${matched.length}`);
  console.log(`  Ambiguous: ${ambiguous.length}`);
  console.log(`  Missing:   ${missing.length}`);

  if (ambiguous.length) {
    console.log("\nAmbiguous rows (multiple projects share PO):");
    for (const a of ambiguous) {
      console.log(`  "${a.po}" → [${a.hits.map((h) => h.code).join(", ")}]`);
    }
  }
  if (missing.length) {
    console.log("\nMissing rows (no matching project):");
    for (const m of missing) console.log(`  "${m.po}"  ₹${m.val}`);
  }

  if (dry) {
    console.log("\nMatched preview:");
    for (const m of matched.slice(0, 10)) {
      console.log(`  ${m.project.code}  ${m.po.padEnd(28)} → ₹${m.val}`);
    }
    console.log("... (dry run, no DB writes)");
    return;
  }

  let updated = 0;
  for (const m of matched) {
    await db.project.update({
      where: { id: m.project.id },
      data: { materialsSupplied: m.val },
    });
    updated++;
  }
  const total = matched.reduce((a, m) => a + m.val, 0);
  console.log(`\n✓ Updated ${updated} projects.`);
  console.log(
    `  Total imported materials-supplied value: ₹${total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
