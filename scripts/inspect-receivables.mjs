import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

const BASE = "C:/Users/LENOVO/Desktop/SAB upload";
const OUT = "C:/Users/LENOVO/Desktop/SAB India/scripts/_dump2";

function cellToText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("formula" in v && "result" in v) return String(v.result ?? "");
    if ("sharedFormula" in v && "result" in v) return String(v.result ?? "");
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if ("formula" in v) return String(v.result ?? v.formula);
    if ("hyperlink" in v) return String(v.text ?? v.hyperlink);
    return JSON.stringify(v);
  }
  return String(v);
}

async function dumpSheet(filePath, sheetName, outName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) { console.log("MISSING", sheetName); return; }
  let lastRow = 0, lastCol = 0;
  sheet.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const t = cellToText(cell.value).trim();
      if (t !== "") { if (r > lastRow) lastRow = r; if (c > lastCol) lastCol = c; }
    });
  });
  const out = [];
  out.push(`SHEET ${sheetName} (data ${lastRow}x${lastCol})`);
  for (let r = 1; r <= Math.min(lastRow, 30); r++) {
    const row = sheet.getRow(r);
    const parts = [];
    let any = false;
    for (let c = 1; c <= lastCol; c++) {
      const t = cellToText(row.getCell(c).value);
      if (t !== "") any = true;
      parts.push(`[${c}]${t}`);
    }
    if (any) out.push(`R${r}: ${parts.join(" | ")}`);
  }
  fs.writeFileSync(path.join(OUT, outName), out.join("\n"));
  console.log("wrote", outName);
}

const recv = path.join(BASE, "Sab Mgps Receivables.xlsx");
await dumpSheet(recv, "Summary 2026-2027", "rcv_summary_2627.txt");
await dumpSheet(recv, "Summary 2025-26", "rcv_summary_2526.txt");
await dumpSheet(recv, "2026-27", "rcv_2627.txt");
await dumpSheet(recv, "2025-26", "rcv_2526.txt");
await dumpSheet(recv, "Balance", "rcv_balance.txt");
await dumpSheet(recv, "Retention Money", "rcv_retention.txt");

await dumpSheet(path.join(BASE, "Stock & assets.xlsx"), "Sheet1", "stock.txt");
