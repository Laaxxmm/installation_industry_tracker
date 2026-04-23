// Dump every sheet/column/row of each xlsx into a per-file text report.
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

const BASE = "C:/Users/LENOVO/Desktop/SAB upload";
const OUT = "C:/Users/LENOVO/Desktop/SAB India/scripts/_dump";
fs.mkdirSync(OUT, { recursive: true });

const FILES = [
  "Fire _PO Details.xlsx",
  "MGPS_ PO Details.xlsx",
  "Sab Mgps Receivables.xlsx",
  "Stock & assets.xlsx",
];

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

function safeName(s) {
  return s.replace(/[^a-z0-9]+/gi, "_").slice(0, 80);
}

for (const f of FILES) {
  const full = path.join(BASE, f);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(full);
  const outFile = path.join(OUT, safeName(f) + ".txt");
  const lines = [];
  lines.push(`FILE: ${f}`);
  wb.eachSheet((sheet) => {
    // find last non-empty row
    let lastRow = 0;
    let lastCol = 0;
    sheet.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        const t = cellToText(cell.value).trim();
        if (t !== "") {
          if (r > lastRow) lastRow = r;
          if (c > lastCol) lastCol = c;
        }
      });
    });
    lines.push("");
    lines.push(`--- Sheet: ${sheet.name} (rows with data: ${lastRow}, cols: ${lastCol})`);
    if (lastRow === 0) return;
    for (let r = 1; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      const vals = [];
      let any = false;
      for (let c = 1; c <= lastCol; c++) {
        const t = cellToText(row.getCell(c).value);
        if (t !== "") any = true;
        vals.push(t);
      }
      if (any) lines.push(`R${r}: ` + vals.map((v, i) => `[${i + 1}]${v}`).join(" | "));
    }
  });
  fs.writeFileSync(outFile, lines.join("\n"));
  console.log("wrote", outFile, "(", lines.length, "lines )");
}
