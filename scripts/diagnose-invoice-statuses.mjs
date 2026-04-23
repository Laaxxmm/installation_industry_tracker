/* eslint-disable no-console */
// Shows per-status invoice counts/totals across ALL projects, and lists any
// project that has DRAFT or CANCELLED invoices (which show in the Invoices
// page but DO NOT count toward the Projects-table Billed column).

import { PrismaClient, InvoiceStatus } from "@prisma/client";

const db = new PrismaClient();

function fmt(n) {
  return Number(n).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

async function main() {
  const statusAgg = await db.clientInvoice.groupBy({
    by: ["status"],
    _sum: { grandTotal: true },
    _count: { _all: true },
  });
  console.log("Invoice counts + totals by status (all projects):");
  for (const s of statusAgg) {
    console.log(
      `  ${s.status.padEnd(10)}  ${String(s._count._all).padStart(4)}  ${fmt(s._sum.grandTotal ?? 0).padStart(18)}`,
    );
  }

  const nonIssuedPaid = await db.clientInvoice.groupBy({
    by: ["projectId", "status"],
    where: { status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] } },
    _sum: { grandTotal: true },
    _count: { _all: true },
  });

  if (nonIssuedPaid.length === 0) {
    console.log("\n✓ No DRAFT or CANCELLED client invoices.");
    return;
  }

  const projectIds = [...new Set(nonIssuedPaid.map((g) => g.projectId))];
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, code: true, name: true, billedValue: true },
  });
  const pMap = new Map(projects.map((p) => [p.id, p]));

  console.log(
    `\n${projectIds.length} project(s) have DRAFT/CANCELLED invoices that DO NOT count toward Billed:\n`,
  );
  const grouped = new Map();
  for (const g of nonIssuedPaid) {
    if (!grouped.has(g.projectId))
      grouped.set(g.projectId, { draft: 0, draftCount: 0, cancelled: 0, cancelledCount: 0 });
    const e = grouped.get(g.projectId);
    if (g.status === InvoiceStatus.DRAFT) {
      e.draft += Number(g._sum.grandTotal ?? 0);
      e.draftCount += g._count._all;
    } else {
      e.cancelled += Number(g._sum.grandTotal ?? 0);
      e.cancelledCount += g._count._all;
    }
  }

  for (const [pid, e] of grouped) {
    const p = pMap.get(pid);
    if (!p) continue;
    const parts = [];
    if (e.draftCount) parts.push(`${e.draftCount} DRAFT = ${fmt(e.draft)}`);
    if (e.cancelledCount)
      parts.push(`${e.cancelledCount} CANCELLED = ${fmt(e.cancelled)}`);
    console.log(
      `  ${p.code.padEnd(14)} stored=${fmt(p.billedValue).padStart(16)}  ${parts.join(" | ")}`,
    );
    console.log(`     ${p.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
