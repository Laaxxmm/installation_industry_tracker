import ExcelJS from "exceljs";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("C:/Users/LENOVO/Desktop/SAB upload/Sab Mgps Receivables.xlsx");
const s = wb.getWorksheet("2024-25");
console.log("rowCount", s.rowCount, "colCount", s.columnCount);
for (let r = 1; r <= Math.min(5, s.rowCount); r++) {
  const row = s.getRow(r);
  const vals = [];
  for (let c = 1; c <= 28; c++) {
    const v = row.getCell(c).value;
    const text = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v);
    vals.push(`[${c}]${text}`);
  }
  console.log(`R${r}:`, vals.join(" | "));
}
