/* eslint-disable no-console */
// Import PO rows from Format.xlsx into Clients + Projects.
// Idempotency: this is a one-shot import. Re-running will create duplicates
// unless you wipe Project/Client first. It intentionally does NOT upsert by
// fileNo/poNumber so a partial failure can be inspected before retry.
//
// Run: node scripts/import-po-format.mjs

import xlsx from "xlsx";
import { PrismaClient, ProjectStatus, POStatus } from "@prisma/client";

const db = new PrismaClient();
const FILE = "C:/Users/LENOVO/Desktop/Kishore Desktop/OThers/SAB MGPS/PO/Format.xlsx";

function excelSerialToDate(n) {
  if (n === null || n === undefined || n === "") return null;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const ms = Date.UTC(1899, 11, 30) + n * 86400000;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d : null;
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[,₹\s]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function txt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function mapPoStatus(s) {
  if (!s) return null;
  const up = s.trim().toUpperCase();
  if (up.includes("RECEIVED")) return POStatus.ISSUED;
  if (up.includes("PENDING")) return POStatus.DRAFT;
  if (up.includes("CANCEL")) return POStatus.CANCELLED;
  return null;
}

function formatCode(year, seq) {
  return `SAB-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextSeq(year, count) {
  const row = await db.projectCodeSequence.upsert({
    where: { year },
    create: { year, next: count + 1 },
    update: { next: { increment: count } },
  });
  // row.next is the value AFTER increment. Start = row.next - count.
  return row.next - count;
}

async function main() {
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets["PO Details"];
  if (!ws) throw new Error("Sheet 'PO Details' not found");
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const dataRows = rows.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ""));
  console.log(`Read ${dataRows.length} data rows from Format.xlsx`);

  // Step 1 — dedup clients by lowercased-trimmed name
  const clientMap = new Map(); // key -> { displayName, id? }
  for (const r of dataRows) {
    const raw = txt(r[4]);
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/\s+/g, " ");
    if (!clientMap.has(key)) clientMap.set(key, { displayName: raw });
  }
  console.log(`Unique clients: ${clientMap.size}`);

  // Step 2 — create (or find) clients
  for (const entry of clientMap.values()) {
    const existing = await db.client.findFirst({
      where: { name: entry.displayName, gstin: null },
    });
    if (existing) {
      entry.id = existing.id;
      continue;
    }
    const created = await db.client.create({
      data: {
        name: entry.displayName,
        billingAddress: "—",
        stateCode: "29", // Karnataka — user can enrich per-client later
        active: true,
      },
    });
    entry.id = created.id;
  }
  console.log(`Clients ready: ${clientMap.size}`);

  // Step 3 — reserve project codes (single shot) for this year
  const year = new Date().getUTCFullYear();
  const startSeq = await nextSeq(year, dataRows.length);
  console.log(`Reserved codes ${formatCode(year, startSeq)} … ${formatCode(year, startSeq + dataRows.length - 1)}`);

  // Step 4 — insert projects
  let inserted = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const fileNo = txt(r[0]);
    const poNumber = r[1] != null ? String(r[1]).trim() : null;
    const poDate = excelSerialToDate(r[2]);
    const poStatus = mapPoStatus(txt(r[3]));
    const clientRaw = txt(r[4]);
    const clientKey = clientRaw ? clientRaw.toLowerCase().replace(/\s+/g, " ") : null;
    const clientEntry = clientKey ? clientMap.get(clientKey) : null;
    const location = txt(r[5]);
    const description = txt(r[6]);
    const projectDetails = txt(r[7]);
    const workStatus = txt(r[8]);
    const finalPo = num(r[9]);
    const billed = num(r[10]);
    const adjBillable = num(r[11]);
    // r[12] = billable values (derived: finalPo + adjBillable - billed)
    // r[13] = need to make bill (derived)
    const response = txt(r[14]);

    const nameParts = [fileNo, poNumber, location].filter(Boolean);
    const name = nameParts.length > 0 ? nameParts.join(" — ") : (clientRaw || `PO ${i + 1}`);

    await db.project.create({
      data: {
        code: formatCode(year, startSeq + i),
        name: name.slice(0, 200),
        clientName: clientRaw || "—",
        clientId: clientEntry?.id ?? null,
        status: ProjectStatus.DRAFT,
        contractValue: finalPo.toFixed(2),
        poDate,
        poStatus,
        poNumber: poNumber ? poNumber.slice(0, 80) : null,
        fileNo: fileNo ? fileNo.slice(0, 40) : null,
        location,
        description,
        projectDetails,
        workStatus,
        billedValue: billed.toFixed(2),
        adjBillableValue: adjBillable.toFixed(2),
        response,
      },
    });
    inserted++;
  }
  console.log(`Inserted ${inserted} projects`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
