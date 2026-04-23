import ExcelJS from "exceljs";

const FILE = "C:/Users/LENOVO/Desktop/Kishore Desktop/OThers/SAB MGPS/PO/Materials Supplied.xlsx";

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
  let rowsWithCol2 = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c1 = cellText(row.getCell(1).value);
    const c2 = cellText(row.getCell(2).value);
    if (c2.trim()) {
      rowsWithCol2++;
      console.log(`R${String(r).padStart(3)} | ${c1} | ${c2}`);
    }
  }
  console.log(`\nTotal rows with non-empty col2: ${rowsWithCol2}`);
}
