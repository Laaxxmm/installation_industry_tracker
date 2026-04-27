/* eslint-disable no-console */
// One-shot importer for the user's projects-2026-04-21.xlsx export.
// Auto-creates Client records for any clientName not already in the DB,
// then upserts each Project by its `code`.
//
// Usage:
//   IMPORT_FILE='C:/path/to/projects-2026-04-21.xlsx' \
//     DATABASE_URL='<railway-prod-url>' \
//     IMPORT_CONFIRM=YES \
//     npx tsx scripts/import-projects-xlsx.ts
//
// Without IMPORT_CONFIRM=YES the script runs in dry-run mode and just
// prints what it would do.

import { PrismaClient, ProjectStatus, POStatus, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

const db = new PrismaClient();

const FILE = process.env.IMPORT_FILE
  ?? "C:/Users/LENOVO/OneDrive - SRCA/Desktop/projects-2026-04-21.xlsx";
const DRY_RUN = process.env.IMPORT_CONFIRM !== "YES";

interface Row {
  Code?: string | null;
  Name?: string | null;
  "PO Number"?: string | null;
  "File No"?: string | null;
  "PO Date"?: string | null;
  FY?: string | null;
  "PO Status"?: string | null;
  "Client Name"?: string | null;
  Location?: string | null;
  Description?: string | null;
  "Project Details"?: string | null;
  "Work Status"?: string | null;
  "Final PO Value (inc GST)"?: number | string | null;
  "Billed Value"?: number | string | null;
  "Adj Billable Value"?: number | string | null;
  "Billable Value"?: number | string | null;
  "Need to Make Bill"?: string | null;
  Response?: string | null;
}

const trim = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
};

const decimal = (v: unknown): Prisma.Decimal => {
  if (v === null || v === undefined || v === "") return new Prisma.Decimal(0);
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(n);
};

// Parses "04 Nov 2026" / "4 Nov 26" / Excel-serial-number to Date or null.
function parsePoDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date — convert to JS Date.
    const epoch = Date.UTC(1899, 11, 30); // Excel's day 0
    return new Date(epoch + v * 86400000);
  }
  const s = String(v).trim();
  if (!s) return null;
  // Try native Date first ("04 Nov 2026" parses fine in modern V8).
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function mapPoStatus(v: unknown): POStatus | null {
  const s = trim(v);
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === "ISSUED") return POStatus.ISSUED;
  if (upper === "DRAFT") return POStatus.DRAFT;
  if (upper === "CANCELLED" || upper === "CANCELED") return POStatus.CANCELLED;
  return null;
}

function mapProjectStatus(workStatus: string | null): ProjectStatus {
  if (!workStatus) return ProjectStatus.ACTIVE;
  const s = workStatus.toUpperCase();
  if (
    s === "WORK COMPLETED" ||
    s === "SERVICE COMPLETED" ||
    s === "SUPPLY COMPLETED"
  ) {
    return ProjectStatus.COMPLETED;
  }
  return ProjectStatus.ACTIVE;
}

async function main() {
  console.log(`=== import-projects-xlsx ===`);
  console.log(`FILE:     ${FILE}`);
  console.log(`DRY_RUN:  ${DRY_RUN}`);
  console.log(
    `DB:       ${process.env.DATABASE_URL?.replace(/:[^@:]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log();

  // ---------- Read sheet ----------
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
  console.log(`Read ${rows.length} rows from sheet "${wb.SheetNames[0]}".`);

  // ---------- Pre-pass: collect distinct client names ----------
  const clientNames = new Set<string>();
  for (const r of rows) {
    const n = trim(r["Client Name"]);
    if (n && n !== "—") clientNames.add(n);
  }
  console.log(`Distinct client names: ${clientNames.size}`);

  // ---------- Pre-pass: validate rows ----------
  const skipped: string[] = [];
  for (const r of rows) {
    const code = trim(r.Code);
    const name = trim(r.Name);
    if (!code) skipped.push(`(blank Code) ${JSON.stringify(r).slice(0, 80)}`);
    else if (!name) skipped.push(`${code}: blank Name`);
  }
  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} invalid rows:`);
    for (const s of skipped.slice(0, 10)) console.log("  ", s);
    if (skipped.length > 10) console.log(`  ... and ${skipped.length - 10} more`);
  }

  if (DRY_RUN) {
    console.log(
      "\nDRY RUN — no DB writes. Set IMPORT_CONFIRM=YES to execute.",
    );
    console.log(`Would create: ${clientNames.size} clients, ${rows.length - skipped.length} projects.`);
    return;
  }

  // ---------- Upsert clients ----------
  console.log("\nUpserting clients...");
  const clientIdByName = new Map<string, string>();
  let clientsCreated = 0;
  let clientsExisting = 0;
  for (const name of clientNames) {
    // findFirst because (name, gstin=null) isn't unique-enforced by Postgres.
    const existing = await db.client.findFirst({ where: { name } });
    if (existing) {
      clientIdByName.set(name, existing.id);
      clientsExisting++;
    } else {
      const created = await db.client.create({
        data: {
          name,
          stateCode: "29", // Karnataka default — matches SAB's home state
          billingAddress: "", // schema requires non-null; you'll fill in via the /clients UI
          active: true,
        },
        select: { id: true },
      });
      clientIdByName.set(name, created.id);
      clientsCreated++;
    }
  }
  console.log(
    `  Clients: ${clientsCreated} created, ${clientsExisting} reused.`,
  );

  // ---------- Upsert projects ----------
  console.log("\nUpserting projects...");
  let projectsCreated = 0;
  let projectsUpdated = 0;
  let projectsFailed = 0;
  for (const r of rows) {
    const code = trim(r.Code);
    const name = trim(r.Name);
    if (!code || !name) continue;

    const clientNameRaw = trim(r["Client Name"]);
    const clientNameClean =
      clientNameRaw && clientNameRaw !== "—" ? clientNameRaw : null;
    const clientId = clientNameClean
      ? clientIdByName.get(clientNameClean) ?? null
      : null;

    const workStatus = trim(r["Work Status"]);
    const data = {
      name,
      clientName: clientNameClean ?? "—",
      clientId,
      status: mapProjectStatus(workStatus),
      poNumber: trim(r["PO Number"]),
      fileNo: trim(r["File No"]),
      poDate: parsePoDate(r["PO Date"]),
      poStatus: mapPoStatus(r["PO Status"]),
      location: trim(r.Location),
      description: trim(r.Description),
      projectDetails: trim(r["Project Details"]),
      workStatus,
      contractValue: decimal(r["Final PO Value (inc GST)"]),
      billedValue: decimal(r["Billed Value"]),
      adjBillableValue: decimal(r["Adj Billable Value"]),
      response: trim(r.Response),
    };

    try {
      const existing = await db.project.findUnique({ where: { code } });
      if (existing) {
        await db.project.update({ where: { code }, data });
        projectsUpdated++;
      } else {
        await db.project.create({ data: { code, ...data } });
        projectsCreated++;
      }
    } catch (err) {
      projectsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${code}: ${msg.slice(0, 200)}`);
    }
  }
  console.log(
    `  Projects: ${projectsCreated} created, ${projectsUpdated} updated, ${projectsFailed} failed.`,
  );

  // ---------- Backfill stages for new projects ----------
  // The seed.ts logic does this but only on container boot, so trigger here.
  const projectsNeedingStages = await db.project.findMany({
    where: { stages: { none: {} } },
    select: { id: true },
  });
  if (projectsNeedingStages.length > 0) {
    console.log(`\nBackfilling stages for ${projectsNeedingStages.length} projects...`);
    const STAGE_KEYS = [
      "SURVEY",
      "DELIVERY",
      "INSTALL",
      "COMMISSION",
      "HANDOVER",
    ] as const;
    for (const p of projectsNeedingStages) {
      await db.projectStage.createMany({
        data: STAGE_KEYS.map((k) => ({ projectId: p.id, stageKey: k })),
        skipDuplicates: true,
      });
    }
    console.log(`  Done.`);
  }

  // ---------- Final counts ----------
  const finalClients = await db.client.count();
  const finalProjects = await db.project.count();
  console.log(`\nFinal DB state: ${finalClients} clients, ${finalProjects} projects.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
