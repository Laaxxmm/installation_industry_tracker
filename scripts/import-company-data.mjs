/* eslint-disable no-console */
// One-time import of real SAB India data from Excel.
// Rule: only keep what's prospective for FY 26-27 onwards.
//   - Project:   active OR has unbilled amount OR has outstanding invoice/retention
//                OR PO date >= 2026-04-01.
//   - Invoice:   invoice date >= 2026-04-01 OR has outstanding balance/retention.
// Runs:  node scripts/import-company-data.mjs

import ExcelJS from "exceljs";
import path from "path";
import crypto from "crypto";
import { PrismaClient, ProjectStatus, InvoiceKind, InvoiceStatus } from "@prisma/client";

const db = new PrismaClient();
const BASE = "C:/Users/LENOVO/Desktop/SAB upload";
const FY_CUTOFF = new Date("2026-04-01T00:00:00.000Z");

// ---------- cell helpers ----------
function cellVal(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) {
      const r = v.result;
      if (r && typeof r === "object") {
        if ("error" in r) return null;
        return null;
      }
      return r;
    }
    if ("richText" in v) return v.richText.map((x) => x.text).join("");
    if ("text" in v) return String(v.text);
    if ("hyperlink" in v) return String(v.text ?? v.hyperlink);
    if ("formula" in v) return v.result ?? null;
    if ("sharedFormula" in v) return v.result ?? null;
    if ("error" in v) return null;
    return null;
  }
  return v;
}
function toText(v) {
  const raw = cellVal(v);
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw).trim();
}
function toNumber(v) {
  const raw = cellVal(v);
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).replace(/[,₹\s]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function toDate(v) {
  const raw = cellVal(v);
  if (raw === null || raw === undefined || raw === "") return null;
  // Excel Date cells come through as JS Date objects — trust the stored serial.
  if (raw instanceof Date) return raw;
  // String cells: treat as DD-MM-YYYY / DD/MM/YY (Indian convention, as used
  // throughout the source workbooks).
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    y = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(Date.UTC(y, Number(mo) - 1, Number(d)));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
// Receivables-sheet variant. The workbook's Date cells are a mixed bag:
//   • Some were entered correctly and the stored serial already matches intent.
//   • Others were entered on an MM-DD-formatted cell, so day↔month are swapped
//     in the stored serial and we need to un-swap to get DD-MM intent.
// We disambiguate using the Month column, which is always typed with day=26
// (>12, unambiguous) so its month is trustworthy. If the invoice/received
// date's month matches the Month column's month, the serial is correct as-is.
// If it differs AND both day/month are ≤ 12 (swap is mathematically valid),
// apply the swap.
function toDateReceivables(v, monthHint /* Date | null */) {
  const raw = cellVal(v);
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) {
    const d = raw.getUTCDate();
    const mo = raw.getUTCMonth() + 1;
    const y = raw.getUTCFullYear();
    if (
      monthHint instanceof Date &&
      monthHint.getUTCMonth() + 1 !== mo &&
      d <= 12 &&
      mo <= 12
    ) {
      return new Date(Date.UTC(y, d - 1, mo));
    }
    return raw;
  }
  return toDate(v);
}
function normPoKey(s) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function slugSku(s) {
  return (
    String(s ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "ITEM"
  );
}
function token() {
  return crypto.randomBytes(32).toString("hex");
}

// ---------- wipe ----------
async function wipeAll() {
  console.log("wiping transactional tables…");
  // order: leaf rows first
  await db.clientInvoiceLine.deleteMany();
  await db.clientInvoice.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.quoteEvent.deleteMany();
  await db.quoteLine.deleteMany();
  await db.quote.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectStage.deleteMany();
  await db.materialTransfer.deleteMany();
  await db.stockIssue.deleteMany();
  await db.stockReceipt.deleteMany();
  await db.directPurchase.deleteMany();
  await db.overheadAllocation.deleteMany();
  await db.invoice.deleteMany();
  await db.budgetLine.deleteMany();
  await db.timeEntry.deleteMany();
  await db.project.deleteMany();
  await db.client.deleteMany();
  await db.material.deleteMany();
  await db.auditLog.deleteMany();
  // reset sequences
  await db.projectCodeSequence.deleteMany();
  await db.quoteNumberSequence.deleteMany();
  await db.pONumberSequence.deleteMany();
  await db.clientInvoiceNumberSequence.deleteMany();
  console.log("wipe complete");
}

// ---------- Excel loaders ----------
async function readSheet(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(BASE, file));
  const s = wb.getWorksheet(sheetName);
  if (!s) throw new Error(`sheet ${sheetName} missing in ${file}`);
  let lastRow = 0,
    lastCol = 0;
  s.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const t = toText(cell.value);
      if (t !== "") {
        if (r > lastRow) lastRow = r;
        if (c > lastCol) lastCol = c;
      }
    });
  });
  return { sheet: s, lastRow, lastCol };
}

// ---------- PO parser (Fire + MGPS) ----------
async function parsePoSheet(file, stream) {
  const { sheet, lastRow } = await readSheet(file, "PO_Details");
  const out = [];
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const fileNo = toText(row.getCell(2).value);
    const poDate = toDate(row.getCell(3).value);
    const poNo = toText(row.getCell(5).value);
    const poStatus = toText(row.getCell(6).value);
    const name = toText(row.getCell(7).value);
    const location = toText(row.getCell(8).value);
    const description = toText(row.getCell(9).value);
    const poValue = toNumber(row.getCell(10).value);
    const amendmentFlag = toText(row.getCell(11).value);
    const amendmentValue = toNumber(row.getCell(12).value);
    const finalPoValue = toNumber(row.getCell(13).value) || poValue + amendmentValue;
    const workStatus = toText(row.getCell(15).value);
    const ra1 = toNumber(row.getCell(19).value);
    const ra2 = toNumber(row.getCell(20).value);
    const ra3 = toNumber(row.getCell(21).value);
    const ra4 = toNumber(row.getCell(22).value);
    const ra5 = toNumber(row.getCell(23).value);
    const finalBill = toNumber(row.getCell(24).value);
    const billedValue = ra1 + ra2 + ra3 + ra4 + ra5 + finalBill;
    const billable = Math.max(finalPoValue - billedValue, 0);
    const pctWork = toNumber(row.getCell(31).value); // 0..1
    const remark1 = toText(row.getCell(34).value);
    const remark2 = toText(row.getCell(35).value);

    if (!name && !poNo && !finalPoValue) continue; // skip blank rows

    out.push({
      stream, // "FIRE" | "MGPS"
      sourceRow: r,
      fileNo,
      poDate,
      poNo,
      poStatus,
      name,
      location,
      description,
      finalPoValue,
      workStatus,
      billedValue,
      billable,
      pctWork,
      remark1,
      remark2,
    });
  }
  return out;
}

// ---------- Receivables parser ----------
async function parseReceivables(sheetName) {
  const { sheet, lastRow } = await readSheet("Sab Mgps Receivables.xlsx", sheetName);
  // Auto-detect column layout from the header row.
  const header = sheet.getRow(1);
  const cols = {};
  for (let c = 1; c <= 30; c++) {
    const h = toText(header.getCell(c).value).toLowerCase().trim();
    if (!h) continue;
    if (h === "po number" || h === "po no" || h === "po#") cols.poNumber = c;
    else if (h === "hospital name" || h === "hospital") cols.hospital = c;
    else if (h === "client") cols.client = c;
    else if (h === "month") cols.month = c;
    else if (h === "invoice #" || h === "invoice no" || h === "invoice#") cols.invoiceNo = c;
    else if (h === "invoice date") cols.invoiceDate = c;
    else if (h === "basic") cols.basic = c;
    else if (h === "gst") cols.gst = c;
    else if (h === "other") cols.other = c;
    else if (h === "total amount 1" || h === "total amount1") cols.totalAmt1 = c;
    else if (h === "credit note") cols.creditNote = c;
    else if (h === "total amount") cols.totalAmt = c;
    else if (h === "invoice status" || h === "status") cols.statusStr = c;
    else if (h === "received") cols.received = c;
    else if (h === "received date") cols.receivedDate = c;
    else if (h === "balance(rs.)" || h === "balance" || h.startsWith("balance")) cols.balance = c;
    else if (h === "tds") cols.tds = c;
    else if (h === "retention money") cols.retention = c;
    else if (h === "retention received") cols.retentionReceived = c;
    else if (h === "retention balance") cols.retentionBalance = c;
    else if (h === "cr period" || h === "credit period") cols.crPeriod = c;
    else if (h === "remarks") cols.remarks = c;
  }
  const rows = [];
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const g = (c) => (c ? row.getCell(c).value : undefined);

    const poNumber = toText(g(cols.poNumber));
    const hospital = toText(g(cols.hospital));
    const client = toText(g(cols.client)) || hospital;
    const invoiceNo = toText(g(cols.invoiceNo));
    // Month column: always typed with day=26 so it's an unambiguous month/year
    // anchor we can use to decide whether the invoice/received date is stored
    // correctly or has day↔month swapped at entry time.
    const monthHintRaw = cellVal(g(cols.month));
    const monthHint = monthHintRaw instanceof Date ? monthHintRaw : null;
    const invoiceDate = toDateReceivables(g(cols.invoiceDate), monthHint);
    const basic = toNumber(g(cols.basic));
    const gst = toNumber(g(cols.gst));
    const other = toNumber(g(cols.other));
    const totalAmt1 = toNumber(g(cols.totalAmt1)) || basic + gst + other;
    const creditNote = toNumber(g(cols.creditNote));
    const totalAmt =
      toNumber(g(cols.totalAmt)) || Math.max(totalAmt1 - creditNote, 0);
    const statusStr = toText(g(cols.statusStr));
    const received = toNumber(g(cols.received));
    // For receivedDate we also anchor on monthHint — same DD-MM vs MM-DD
    // entry swap applies to the whole row.
    const receivedDate = toDateReceivables(g(cols.receivedDate), monthHint);
    const balanceRaw = toNumber(g(cols.balance));
    const tds = toNumber(g(cols.tds));
    const retention = toNumber(g(cols.retention));
    const retentionReceived = toNumber(g(cols.retentionReceived));
    const retentionBalance = toNumber(g(cols.retentionBalance));
    const crPeriod = toNumber(g(cols.crPeriod));
    const remarks = toText(g(cols.remarks));

    // compute balance if formula didn't resolve
    const balance = balanceRaw || Math.max(totalAmt - received - tds - retention, 0);

    if (!invoiceNo && !invoiceDate && !totalAmt) continue;
    if (!client || client === "Cancelled") continue;

    rows.push({
      sheet: sheetName,
      poNumber,
      hospital,
      client,
      invoiceNo,
      invoiceDate,
      basic,
      gst,
      other,
      totalAmt,
      creditNote,
      statusStr,
      received,
      receivedDate,
      balance,
      tds,
      retention,
      retentionReceived,
      retentionBalance,
      crPeriod,
      remarks,
    });
  }
  return rows;
}

// ---------- Stock parser ----------
async function parseStock() {
  const { sheet, lastRow } = await readSheet("Stock & assets.xlsx", "Sheet1");
  const out = [];
  const seen = new Set();
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const itemName = toText(row.getCell(2).value);
    const initial = toNumber(row.getCell(3).value);
    const final = toNumber(row.getCell(34).value) || initial;
    const price = toNumber(row.getCell(35).value);
    if (!itemName) continue;
    let sku = slugSku(itemName);
    let counter = 1;
    while (seen.has(sku)) {
      counter++;
      sku = slugSku(itemName) + "-" + counter;
    }
    seen.add(sku);
    out.push({ sku, name: itemName, qty: final, unitCost: price });
  }
  return out;
}

// ---------- filtering ----------
// Fresh-start-at-FY-26-27 rule. Old pre-Apr-2026 history stays in Excel; the
// tracker only carries what's live from 1 Apr 2026 onwards.
//
// Keep a project if ANY of:
//   • Work is still active (not completed) — it will generate FY 26-27 activity
//   • PO was issued on/after 1 Apr 2026 (definitionally FY 26-27 work)
//   • It has at least one invoice dated on/after 1 Apr 2026 (active billing cycle)
// Otherwise drop — a completed, pre-FY project with no current-FY invoicing
// is effectively archived to the source spreadsheet.
function isProjectRelevant(po, hasFyInvoice) {
  const ws = (po.workStatus || "").toUpperCase();
  const isCompleted = ws.includes("COMPLETED") || ws.includes("COMPLETE");
  const preFY = po.poDate && po.poDate < FY_CUTOFF;
  if (!isCompleted) return true;
  if (!preFY) return true;
  if (hasFyInvoice) return true;
  return false;
}

// Invoices: keep only those raised on/after 1 Apr 2026. Older invoices —
// paid or still outstanding — stay in the source spreadsheet per the
// fresh-start rule; we don't want to carry legacy receivables into the tool.
function isInvoiceRelevant(inv) {
  return Boolean(inv.invoiceDate && inv.invoiceDate >= FY_CUTOFF);
}

// ---------- main ----------
async function main() {
  await wipeAll();

  // ensure a user to own imported records
  const admin =
    (await db.user.findUnique({ where: { email: "admin@sab.local" } })) ??
    (await db.user.create({
      data: {
        email: "admin@sab.local",
        name: "Asha Admin",
        role: "ADMIN",
        passwordHash: "$2a$10$placeholder",
      },
    }));
  console.log("admin user:", admin.email);

  // --- parse ---
  console.log("reading Fire PO sheet…");
  const firePos = await parsePoSheet("Fire _PO Details.xlsx", "FIRE");
  console.log(`  fire: ${firePos.length} rows`);
  console.log("reading MGPS PO sheet…");
  const mgpsPos = await parsePoSheet("MGPS_ PO Details.xlsx", "MGPS");
  console.log(`  mgps: ${mgpsPos.length} rows`);
  const allPos = [...firePos, ...mgpsPos];

  console.log("reading receivables…");
  const inv2425 = await parseReceivables("2024-25");
  const inv2526 = await parseReceivables("2025-26");
  const inv2627 = await parseReceivables("2026-27");
  console.log(`  2024-25: ${inv2425.length}  2025-26: ${inv2526.length}  2026-27: ${inv2627.length}`);
  const allInvoicesRaw = [...inv2425, ...inv2526, ...inv2627];

  console.log("reading stock…");
  const stock = await parseStock();
  console.log(`  stock items: ${stock.length}`);

  // --- filter invoices ---
  const invoices = allInvoicesRaw.filter(isInvoiceRelevant);
  console.log(`keeping ${invoices.length} invoices (FY 26-27+ only)`);

  // index invoices by normalized PO
  const invByPo = new Map();
  for (const inv of invoices) {
    const k = normPoKey(inv.poNumber);
    if (!k) continue;
    if (!invByPo.has(k)) invByPo.set(k, []);
    invByPo.get(k).push(inv);
  }

  // --- filter POs ---
  const posKept = allPos.filter((po) =>
    isProjectRelevant(po, invByPo.has(normPoKey(po.poNo))),
  );
  console.log(`keeping ${posKept.length} POs as projects`);

  // --- collect clients ---
  // Client names come from (a) relevant PO Name; (b) relevant invoice Client.
  const clientNames = new Set();
  for (const po of posKept) if (po.name) clientNames.add(po.name);
  for (const inv of invoices) if (inv.client) clientNames.add(inv.client);

  console.log(`creating ${clientNames.size} clients…`);
  const clientByName = new Map();
  for (const cn of clientNames) {
    const c = await db.client.create({
      data: {
        name: cn,
        billingAddress: cn,
        stateCode: "29", // default Karnataka; unknown per row
        active: true,
      },
    });
    clientByName.set(cn, c.id);
  }

  // --- create projects from kept POs ---
  console.log("creating projects from PO rows…");
  const projectByPoKey = new Map(); // normPoKey -> project
  let firSeq = 0;
  let mgSeq = 0;
  for (const po of posKept) {
    const clientId = clientByName.get(po.name) ?? null;
    const prefix = po.stream === "FIRE" ? "FIR" : "MGP";
    const seq = po.stream === "FIRE" ? ++firSeq : ++mgSeq;
    const code = `SAB-2026-${prefix}${String(seq).padStart(3, "0")}`;
    const pname =
      [po.location, po.description].filter(Boolean).join(" — ") ||
      po.poNo ||
      "Imported project";
    const ws = (po.workStatus || "").toUpperCase();
    const status =
      ws.includes("COMPLETED")
        ? ProjectStatus.COMPLETED
        : ws.includes("PROGRESS")
          ? ProjectStatus.ACTIVE
          : ws.includes("PENDING") || ws.includes("NOT YET")
            ? ProjectStatus.DRAFT
            : ProjectStatus.ACTIVE;
    const project = await db.project.create({
      data: {
        code,
        name: pname.slice(0, 150),
        clientName: po.name || "(unknown)",
        clientId,
        status,
        contractValue: po.finalPoValue.toFixed(2),
        startDate: po.poDate ?? null,
        endDate: null,
      },
    });
    // seed stages
    const stageKeys = ["SURVEY", "DELIVERY", "INSTALL", "COMMISSION", "HANDOVER"];
    await db.projectStage.createMany({
      data: stageKeys.map((sk) => ({ projectId: project.id, stageKey: sk })),
    });
    projectByPoKey.set(normPoKey(po.poNo), { id: project.id, clientId, fileNo: po.fileNo, poRow: po });
  }

  // --- for any relevant invoice whose PO didn't match a project, create a stub project ---
  console.log("creating stub projects for unmatched invoices…");
  let stubSeq = 0;
  const invByProject = new Map(); // projectId -> list
  for (const inv of invoices) {
    const k = normPoKey(inv.poNumber);
    let entry = projectByPoKey.get(k);
    if (!entry) {
      stubSeq++;
      const code = `SAB-2026-INV${String(stubSeq).padStart(3, "0")}`;
      const clientId = clientByName.get(inv.client) ?? null;
      const project = await db.project.create({
        data: {
          code,
          name:
            (inv.hospital || inv.client || "Direct billing").slice(0, 150) +
            (inv.poNumber ? ` (${inv.poNumber})` : ""),
          clientName: inv.client || "(unknown)",
          clientId,
          status: inv.balance > 1 ? ProjectStatus.ACTIVE : ProjectStatus.COMPLETED,
          contractValue: inv.totalAmt.toFixed(2),
          startDate: inv.invoiceDate ?? null,
        },
      });
      await db.projectStage.createMany({
        data: ["SURVEY", "DELIVERY", "INSTALL", "COMMISSION", "HANDOVER"].map((sk) => ({
          projectId: project.id,
          stageKey: sk,
        })),
      });
      entry = { id: project.id, clientId, fileNo: null, poRow: null };
      projectByPoKey.set(k || `__stub_${stubSeq}`, entry);
    }
    if (!invByProject.has(entry.id)) invByProject.set(entry.id, []);
    invByProject.get(entry.id).push(inv);
  }

  // --- create ClientInvoices ---
  console.log("creating client invoices…");
  let invCounter = 0;
  const usedInvoiceNos = new Set();
  for (const inv of invoices) {
    const k = normPoKey(inv.poNumber);
    const entry = projectByPoKey.get(k);
    if (!entry) continue; // shouldn't happen
    const clientId = clientByName.get(inv.client) ?? entry.clientId;
    if (!clientId) continue;
    const year = inv.invoiceDate ? inv.invoiceDate.getUTCFullYear() : 2026;
    let invoiceNo = `SAB-INV-${year}-${String(inv.invoiceNo || ++invCounter).padStart(4, "0")}`;
    while (usedInvoiceNos.has(invoiceNo)) invoiceNo += "-" + (++invCounter);
    usedInvoiceNos.add(invoiceNo);

    const subtotal = inv.basic;
    const gst = inv.gst;
    const grand = inv.totalAmt || subtotal + gst;
    const amountPaid = Math.min(inv.received, grand);
    const status =
      amountPaid >= grand - 0.5 && grand > 0
        ? InvoiceStatus.PAID
        : inv.invoiceDate
          ? InvoiceStatus.ISSUED
          : InvoiceStatus.DRAFT;

    // intra-state default: CGST + SGST split
    const cgst = gst / 2;
    const sgst = gst / 2;

    await db.clientInvoice.create({
      data: {
        invoiceNo,
        kind: InvoiceKind.PROGRESS,
        status,
        projectId: entry.id,
        clientId,
        placeOfSupplyStateCode: "29",
        issuedAt: inv.invoiceDate,
        subtotal: subtotal.toFixed(2),
        cgst: cgst.toFixed(2),
        sgst: sgst.toFixed(2),
        igst: "0.00",
        taxTotal: gst.toFixed(2),
        grandTotal: grand.toFixed(2),
        amountPaid: amountPaid.toFixed(2),
        paidAt: status === InvoiceStatus.PAID ? inv.receivedDate ?? inv.invoiceDate : null,
        notes: [
          inv.remarks || null,
          inv.retentionBalance > 1 ? `Retention balance: ₹${inv.retentionBalance.toFixed(2)}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        poRef: inv.poNumber || null,
        createdById: admin.id,
        shareToken: token(),
        lines: {
          create: [
            {
              sortOrder: 0,
              description:
                (inv.hospital && inv.hospital !== inv.client
                  ? `${inv.hospital} — `
                  : "") +
                (inv.poNumber ? `PO ${inv.poNumber} — ` : "") +
                "Supply & installation",
              quantity: "1",
              unit: "lot",
              unitPrice: subtotal.toFixed(2),
              discountPct: "0",
              gstRatePct: subtotal > 0 ? ((gst * 100) / subtotal).toFixed(2) : "0",
              lineSubtotal: subtotal.toFixed(2),
              lineTax: gst.toFixed(2),
              lineTotal: (subtotal + gst).toFixed(2),
            },
          ],
        },
      },
    });
  }
  console.log(`  wrote ${invoices.length} invoices`);

  // --- create Materials + opening StockReceipt ---
  console.log("creating materials + opening stock receipts…");
  let stockCreated = 0;
  for (const item of stock) {
    if (item.qty <= 0 && item.unitCost <= 0) continue;
    const mat = await db.material.create({
      data: {
        sku: item.sku,
        name: item.name.slice(0, 200),
        unit: "nos",
        onHandQty: item.qty.toFixed(3),
        avgUnitCost: item.unitCost.toFixed(4),
        active: true,
      },
    });
    if (item.qty > 0) {
      await db.stockReceipt.create({
        data: {
          materialId: mat.id,
          qty: item.qty.toFixed(3),
          unitCost: item.unitCost.toFixed(4),
          supplier: "Opening balance (imported)",
          receivedAt: new Date("2026-04-01T00:00:00.000Z"),
          note: "Opening stock imported from Stock & assets.xlsx",
        },
      });
    }
    stockCreated++;
  }
  console.log(`  wrote ${stockCreated} materials`);

  // --- summary ---
  const counts = {
    clients: await db.client.count(),
    projects: await db.project.count(),
    invoices: await db.clientInvoice.count(),
    materials: await db.material.count(),
    stockReceipts: await db.stockReceipt.count(),
    projectStages: await db.projectStage.count(),
  };
  console.log("\n=== IMPORT COMPLETE ===");
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
