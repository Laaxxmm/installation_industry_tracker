/* eslint-disable no-console */
// Wipes ALL business + user data so the system can be loaded fresh.
// Schema and migrations survive untouched. After running this, log-in is
// IMPOSSIBLE until you run scripts/create-admin.ts to seed one ADMIN user.
//
// Usage:
//   tsx --env-file=.env.local scripts/wipe-data.ts                 # dry-run
//   WIPE_CONFIRM=YES_DELETE_EVERYTHING tsx --env-file=.env.local scripts/wipe-data.ts
//
// Against Railway production:
//   DATABASE_URL='<railway-url>' WIPE_CONFIRM=YES_DELETE_EVERYTHING \
//     npx tsx scripts/wipe-data.ts
//   # then immediately:
//   ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... \
//     DATABASE_URL='<railway-url>' npx tsx scripts/create-admin.ts
//
// PRESERVES:
//   - _prisma_migrations    · system table, never touch
//
// WIPES (everything else): all business + audit + sequence + user tables.
// This is the "blank slate" version. To bootstrap a real admin user back in
// after this runs, use `scripts/create-admin.ts`.
//
// Uses one TRUNCATE ... CASCADE so Postgres handles FK order itself.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const KEEP_TABLES: readonly string[] = [];

// Order doesn't matter inside one CASCADE — Postgres works it out.
const WIPE_TABLES = [
  // Audit
  "AuditLog",
  "AIPromptLog",

  // Sales
  "ClientInvoiceLine",
  "ClientInvoice",
  "PurchaseOrder",
  "QuoteEvent",
  "QuoteLine",
  "Quote",

  // Projects + work
  "ProjectMilestone",
  "ProjectStage",
  "BudgetLine",
  "OverheadAllocation",
  "MaterialTransfer",
  "DirectPurchase",
  "Invoice",

  // Inventory
  "StockIssue",
  "StockReceipt",
  "Material",

  // Timesheets + mobile
  "MobileOp",
  "MobileDevice",
  "MobileSession",
  "TimeEntry",

  // After-sales
  "ServiceVisit",
  "ServiceIssue",
  "AMCVisit",
  "AMCSLA",
  "AMC",

  // Procurement
  "VendorBillLine",
  "VendorBill",
  "GRNLine",
  "GRN",
  "VendorPOLine",
  "VendorPO",
  "Vendor",

  // Roots
  "Project",
  "Client",

  // Number sequences (so numbering restarts at 1 / FY)
  "ProjectCodeSequence",
  "QuoteNumberSequence",
  "PONumberSequence",
  "ClientInvoiceNumberSequence",
  "VendorCodeSequence",
  "VendorPONumberSequence",
  "GRNNumberSequence",
  "VendorBillNumberSequence",
  "AMCNumberSequence",
  "ServiceTicketNumberSequence",

  // Users + payroll config (cascade handles FKs but listing them keeps
  // the wipe explicit and TRUNCATE atomic).
  "EmployeeRateCard",
  "User",
] as const;

async function rowCounts(tables: readonly string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tables) {
    try {
      const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM "${t}"`,
      );
      out[t] = Number(rows[0]?.n ?? 0);
    } catch (err) {
      out[t] = -1; // table missing; flag but don't fail
      console.error(`  warn: count("${t}") failed:`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}

function printCounts(label: string, counts: Record<string, number>): void {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const total = entries.reduce((s, [, n]) => s + (n > 0 ? n : 0), 0);
  console.log(`${label} (${total} rows across ${entries.length} tables):`);
  for (const [t, n] of entries) {
    console.log(`    ${t.padEnd(36)} ${n}`);
  }
}

async function main(): Promise<void> {
  console.log("=== wipe-data ===");
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:[^@:]+@/, ":***@") ?? "<unset>");
  console.log();

  console.log("KEEP:", KEEP_TABLES.join(", "));
  console.log();

  const before = await rowCounts(WIPE_TABLES);
  printCounts("BEFORE (target tables)", before);
  console.log();

  const keepBefore = await rowCounts(KEEP_TABLES);
  printCounts("KEEP tables (untouched)", keepBefore);
  console.log();

  if (process.env.WIPE_CONFIRM !== "YES_DELETE_EVERYTHING") {
    console.log(
      "DRY-RUN — no changes made. Set WIPE_CONFIRM=YES_DELETE_EVERYTHING to execute.",
    );
    return;
  }

  console.log("Executing TRUNCATE ... CASCADE …");
  // Single statement — Postgres handles dependency order with CASCADE.
  // RESTART IDENTITY resets any serial sequences (no-op here since we use cuid()).
  const quoted = WIPE_TABLES.map((t) => `"${t}"`).join(", ");
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`,
  );
  console.log("Done.");
  console.log();

  const after = await rowCounts(WIPE_TABLES);
  printCounts("AFTER (target tables)", after);
  console.log();

  const keepAfter = await rowCounts(KEEP_TABLES);
  printCounts("KEEP tables (verify untouched)", keepAfter);

  const stillNonEmpty = Object.entries(after).filter(([, n]) => n > 0);
  if (stillNonEmpty.length > 0) {
    console.error("\nERROR: tables still non-empty after wipe:");
    for (const [t, n] of stillNonEmpty) console.error(`  ${t}: ${n}`);
    process.exitCode = 1;
  }

  const keepDelta = KEEP_TABLES.filter(
    (t) => keepAfter[t] !== keepBefore[t],
  );
  if (keepDelta.length > 0) {
    console.error("\nERROR: KEEP tables changed during wipe:");
    for (const t of keepDelta) {
      console.error(`  ${t}: ${keepBefore[t]} -> ${keepAfter[t]}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
