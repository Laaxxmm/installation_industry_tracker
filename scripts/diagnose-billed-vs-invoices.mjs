/* eslint-disable no-console */
// Reports projects where the stored Project.billedValue does NOT equal the
// sum of its ClientInvoice.grandTotal (ISSUED + PAID only).
//
// Usage: node scripts/diagnose-billed-vs-invoices.mjs
//        node scripts/diagnose-billed-vs-invoices.mjs --all   (show all, incl. zero-diff)
//        node scripts/diagnose-billed-vs-invoices.mjs --csv   (emit CSV instead of table)

import { PrismaClient, InvoiceStatus } from "@prisma/client";

const db = new PrismaClient();

function fmt(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

async function main() {
  const showAll = process.argv.includes("--all");
  const asCsv = process.argv.includes("--csv");

  const projects = await db.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      clientId: true,
      billedValue: true,
    },
    orderBy: [{ code: "asc" }],
  });

  const grouped = await db.clientInvoice.groupBy({
    by: ["projectId", "status"],
    _sum: { grandTotal: true },
    _count: { _all: true },
  });

  const byProject = new Map();
  for (const g of grouped) {
    const k = g.projectId;
    if (!byProject.has(k)) {
      byProject.set(k, {
        issuedPaid: 0,
        issuedPaidCount: 0,
        draft: 0,
        draftCount: 0,
        cancelled: 0,
        cancelledCount: 0,
      });
    }
    const entry = byProject.get(k);
    const amt = Number(g._sum.grandTotal ?? 0);
    if (g.status === InvoiceStatus.ISSUED || g.status === InvoiceStatus.PAID) {
      entry.issuedPaid += amt;
      entry.issuedPaidCount += g._count._all;
    } else if (g.status === InvoiceStatus.DRAFT) {
      entry.draft += amt;
      entry.draftCount += g._count._all;
    } else if (g.status === InvoiceStatus.CANCELLED) {
      entry.cancelled += amt;
      entry.cancelledCount += g._count._all;
    }
  }

  const rows = [];
  for (const p of projects) {
    const stored = Number(p.billedValue ?? 0);
    const inv = byProject.get(p.id) ?? {
      issuedPaid: 0,
      issuedPaidCount: 0,
      draft: 0,
      draftCount: 0,
      cancelled: 0,
      cancelledCount: 0,
    };
    const diff = stored - inv.issuedPaid;
    if (!showAll && Math.abs(diff) < 0.5) continue;
    rows.push({
      code: p.code,
      name: p.name,
      client: p.clientName,
      hasClientLink: !!p.clientId,
      stored,
      invoiced: inv.issuedPaid,
      invCount: inv.issuedPaidCount,
      draft: inv.draft,
      draftCount: inv.draftCount,
      cancelled: inv.cancelled,
      cancelledCount: inv.cancelledCount,
      diff,
    });
  }

  rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (asCsv) {
    console.log(
      "code,name,client,hasClientLink,stored_billedValue,invoiced_ISSUED_PAID,invoiced_count,draft_total,draft_count,cancelled_total,cancelled_count,difference",
    );
    for (const r of rows) {
      const safe = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      console.log(
        [
          r.code,
          safe(r.name),
          safe(r.client),
          r.hasClientLink,
          r.stored,
          r.invoiced,
          r.invCount,
          r.draft,
          r.draftCount,
          r.cancelled,
          r.cancelledCount,
          r.diff,
        ].join(","),
      );
    }
  } else {
    if (rows.length === 0) {
      console.log("✓ All projects match: stored billedValue == sum(ClientInvoice ISSUED+PAID).");
    } else {
      console.log(
        `Found ${rows.length} project(s) where stored billedValue differs from tax-invoice total (ISSUED+PAID):\n`,
      );
      console.log(
        "CODE            STORED              INVOICED            DIFF                 CNT  NOTES".padEnd(
          100,
        ),
      );
      console.log("-".repeat(120));
      for (const r of rows) {
        const notes = [];
        if (!r.hasClientLink) notes.push("NO CLIENT LINK");
        if (r.draftCount > 0)
          notes.push(`${r.draftCount} draft(s) = ${fmt(r.draft)}`);
        if (r.cancelledCount > 0)
          notes.push(
            `${r.cancelledCount} cancelled = ${fmt(r.cancelled)}`,
          );
        const line = [
          r.code.padEnd(14),
          fmt(r.stored).padStart(18),
          fmt(r.invoiced).padStart(18),
          fmt(r.diff).padStart(18),
          String(r.invCount).padStart(4),
          notes.join("; "),
        ].join("  ");
        console.log(line);
        console.log(`    ${r.name}${r.client ? " — " + r.client : ""}`);
      }
    }
  }

  const totals = rows.reduce(
    (a, r) => {
      a.stored += r.stored;
      a.invoiced += r.invoiced;
      a.diff += r.diff;
      return a;
    },
    { stored: 0, invoiced: 0, diff: 0 },
  );
  if (!asCsv) {
    console.log("\nTotals across divergent projects:");
    console.log(`  Stored billedValue : ${fmt(totals.stored)}`);
    console.log(`  Invoiced (I+P)     : ${fmt(totals.invoiced)}`);
    console.log(`  Net diff           : ${fmt(totals.diff)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
