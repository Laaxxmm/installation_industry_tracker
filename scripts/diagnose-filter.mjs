// Diagnose what the PO filter kept vs dropped and why.
import ExcelJS from "exceljs";
import path from "path";

const BASE = "C:/Users/LENOVO/Desktop/SAB upload";
const FY_CUTOFF = new Date("2026-04-01T00:00:00.000Z");

function cellVal(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return v.result;
    if ("richText" in v) return v.richText.map((x) => x.text).join("");
    if ("text" in v) return String(v.text);
    return null;
  }
  return v;
}
function toText(v) {
  const r = cellVal(v);
  if (r === null || r === undefined) return "";
  if (r instanceof Date) return r.toISOString().slice(0, 10);
  return String(r).trim();
}
function toNumber(v) {
  const r = cellVal(v);
  if (typeof r === "number") return r;
  const n = parseFloat(String(r ?? "").replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toDate(v) {
  const r = cellVal(v);
  if (r instanceof Date) return r;
  if (!r) return null;
  const s = String(r).trim();
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    y = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(Date.UTC(y, Number(mo) - 1, Number(d)));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function load(file, stream) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(BASE, file));
  const s = wb.getWorksheet("PO_Details");
  let lr = 0;
  s.eachRow({ includeEmpty: false }, (_row, r) => (lr = Math.max(lr, r)));
  const out = [];
  for (let r = 2; r <= lr; r++) {
    const row = s.getRow(r);
    const name = toText(row.getCell(7).value);
    const poNo = toText(row.getCell(5).value);
    const finalPoValue = toNumber(row.getCell(13).value) || toNumber(row.getCell(10).value);
    if (!name && !poNo && !finalPoValue) continue;
    out.push({
      stream,
      row: r,
      poDate: toDate(row.getCell(3).value),
      poNo,
      name,
      location: toText(row.getCell(8).value),
      description: toText(row.getCell(9).value),
      workStatus: toText(row.getCell(15).value),
      finalPoValue,
      billed:
        toNumber(row.getCell(19).value) +
        toNumber(row.getCell(20).value) +
        toNumber(row.getCell(21).value) +
        toNumber(row.getCell(22).value) +
        toNumber(row.getCell(23).value) +
        toNumber(row.getCell(24).value),
    });
  }
  return out;
}

const fire = await load("Fire _PO Details.xlsx", "FIRE");
const mgps = await load("MGPS_ PO Details.xlsx", "MGPS");
const all = [...fire, ...mgps];

// Work status distribution
const byStatus = {};
for (const p of all) {
  const k = p.workStatus || "(blank)";
  byStatus[k] = (byStatus[k] || 0) + 1;
}
console.log("--- Work status distribution across all PO rows ---");
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}

// Show rows currently filtered OUT under my rule
function oldRule(po) {
  if (po.poDate && po.poDate >= FY_CUTOFF) return true;
  const ws = (po.workStatus || "").toUpperCase();
  if (ws.includes("PROGRESS") || ws.includes("PENDING") || ws.includes("NOT YET"))
    return true;
  const billable = Math.max(po.finalPoValue - po.billed, 0);
  if (billable > 100) return true;
  return false;
}
const droppedOld = all.filter((p) => !oldRule(p));
console.log(`\n--- Dropped by CURRENT rule: ${droppedOld.length} rows ---`);
for (const p of droppedOld.slice(0, 30)) {
  const billable = Math.max(p.finalPoValue - p.billed, 0);
  console.log(
    `  ${p.stream} R${String(p.row).padStart(3)}  ${(p.workStatus || "(blank)").padEnd(18)}  po=₹${p.finalPoValue.toFixed(0).padStart(10)}  billed=₹${p.billed.toFixed(0).padStart(10)}  unbilled=₹${billable.toFixed(0).padStart(8)}  ${p.poNo}`,
  );
}

// Propose new rule: default-keep; drop only when COMPLETED + fully billed + pre-FY
function newRule(po) {
  const ws = (po.workStatus || "").toUpperCase();
  const isCompleted = ws.includes("COMPLETED") || ws.includes("COMPLETE");
  const billable = Math.max(po.finalPoValue - po.billed, 0);
  const fullyBilled = billable <= 100;
  const preFY = po.poDate && po.poDate < FY_CUTOFF;
  return !(isCompleted && fullyBilled && preFY);
}
const droppedNew = all.filter((p) => !newRule(p));
console.log(`\n--- Dropped by NEW (default-keep) rule: ${droppedNew.length} rows ---`);
for (const p of droppedNew) {
  const billable = Math.max(p.finalPoValue - p.billed, 0);
  console.log(
    `  ${p.stream} R${String(p.row).padStart(3)}  ${(p.workStatus || "(blank)").padEnd(18)}  po=₹${p.finalPoValue.toFixed(0).padStart(10)}  billed=₹${p.billed.toFixed(0).padStart(10)}  unbilled=₹${billable.toFixed(0).padStart(8)}  ${p.poNo}`,
  );
}

console.log(
  `\nDiff: current rule drops ${droppedOld.length}, new rule drops ${droppedNew.length}.`,
);
console.log(`New rule keeps ${all.length - droppedNew.length} projects.`);
