import ExcelJS from "exceljs";

const FILE = "C:/Users/LENOVO/Desktop/Kishore Desktop/OThers/SAB MGPS/PO/Stock Format.xlsx";

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

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

for (const ws of wb.worksheets) {
  console.log(`\n=== Sheet: ${ws.name} (${ws.rowCount} rows × ${ws.columnCount} cols) ===`);
  const limit = ws.rowCount;
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      cells.push(cellText(row.getCell(c).value));
    }
    console.log(`R${String(r).padStart(3)} | ${cells.join(" | ")}`);
  }
  if (ws.rowCount > limit) console.log(`... ${ws.rowCount - limit} more rows`);
}
