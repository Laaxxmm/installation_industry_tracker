// Focused inspector: dumps only the structured "PO_Details" and receivables sheets.
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

const BASE = "C:/Users/LENOVO/Desktop/SAB upload";
const OUT = "C:/Users/LENOVO/Desktop/SAB India/scripts/_dump2";
fs.mkdirSync(OUT, { recursive: true });

function cellToText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) {
      const r = v.result;
      if (r && typeof r === "object" && "error" in r) return `#ERR:${r.error}`;
      return String(r ?? "");
    }
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("formula" in v) return String(v.result ?? v.formula);
    if ("hyperlink" in v) return String(v.text ?? v.hyperlink);
    if ("error" in v) return `#ERR:${v.error}`;
    return JSON.stringify(v);
  }
  if (typeof v === "number") return String(v);
  return String(v);
}

async function dumpSheet(filePath, sheetName, outName, maxRows = 200) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) { console.log("MISSING sheet", sheetName, "in", filePath); return; }
  let lastRow = 0, lastCol = 0;
  sheet.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const t = cellToText(cell.value).trim();
      if (t !== "") { if (r > lastRow) lastRow = r; if (c > lastCol) lastCol = c; }
    });
  });
  const useRows = Math.min(lastRow, maxRows);
  const out = [];
  out.push(`FILE: ${path.basename(filePath)} · SHEET: ${sheetName} (data: ${lastRow}x${lastCol})`);
  // First pass: headers row 1
  const header = sheet.getRow(1);
  out.push("HEADERS:");
  for (let c = 1; c <= lastCol; c++) {
    out.push(`  col ${c}: ${cellToText(header.getCell(c).value)}`);
  }
  out.push("\nROWS:");
  for (let r = 2; r <= useRows; r++) {
    const row = sheet.getRow(r);
    let any = false;
    const parts = [];
    for (let c = 1; c <= lastCol; c++) {
      const t = cellToText(row.getCell(c).value);
      if (t !== "") any = true;
      parts.push(`[${c}]${t}`);
    }
    if (any) out.push(`R${r}: ` + parts.join(" | "));
  }
  fs.writeFileSync(path.join(OUT, outName), out.join("\n"));
  console.log("wrote", outName, "rows", useRows);
}

await dumpSheet(path.join(BASE, "Fire _PO Details.xlsx"), "PO_Details", "fire_po.txt");
await dumpSheet(path.join(BASE, "MGPS_ PO Details.xlsx"), "PO_Details", "mgps_po.txt");

// Receivables — list all sheet names first
{
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(BASE, "Sab Mgps Receivables.xlsx"));
  const out = [];
  wb.eachSheet((sheet) => {
    let lastRow = 0, lastCol = 0;
    sheet.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (cellToText(cell.value).trim() !== "") { if (r > lastRow) lastRow = r; if (c > lastCol) lastCol = c; }
      });
    });
    out.push(`SHEET ${sheet.name}: ${lastRow}x${lastCol}`);
  });
  fs.writeFileSync(path.join(OUT, "receivables_sheets.txt"), out.join("\n"));
  console.log("receivables sheet map written");
}

// Stock sheet names
{
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(BASE, "Stock & assets.xlsx"));
  const out = [];
  wb.eachSheet((sheet) => {
    let lastRow = 0, lastCol = 0;
    sheet.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (cellToText(cell.value).trim() !== "") { if (r > lastRow) lastRow = r; if (c > lastCol) lastCol = c; }
      });
    });
    out.push(`SHEET ${sheet.name}: ${lastRow}x${lastCol}`);
  });
  fs.writeFileSync(path.join(OUT, "stock_sheets.txt"), out.join("\n"));
  console.log("stock sheet map written");
}
