import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

async function main() {
  const topClients = await db.client.findMany({
    orderBy: { name: "asc" },
    take: 8,
    include: {
      _count: { select: { projects: true, clientInvoices: true } },
    },
  });
  console.log("\n--- Top clients by name (sample) ---");
  for (const c of topClients) {
    console.log(`  ${c.name.padEnd(55)}  ${c._count.projects} projects, ${c._count.clientInvoices} invoices`);
  }

  const topProjects = await db.project.findMany({
    orderBy: { contractValue: "desc" },
    take: 10,
    select: { code: true, name: true, clientName: true, contractValue: true, status: true, startDate: true },
  });
  console.log("\n--- Top 10 projects by contract value ---");
  for (const p of topProjects) {
    console.log(
      `  ${p.code}  ${p.status.padEnd(10)}  ${fmt(p.contractValue).padStart(15)}  ${p.name.slice(0, 55)}`,
    );
  }

  const totals = await db.clientInvoice.aggregate({
    _sum: { grandTotal: true, amountPaid: true },
    _count: true,
  });
  console.log("\n--- Invoice totals ---");
  console.log("  count:", totals._count);
  console.log("  total billed:", fmt(totals._sum.grandTotal ?? 0));
  console.log("  total received:", fmt(totals._sum.amountPaid ?? 0));
  console.log(
    "  outstanding:",
    fmt((totals._sum.grandTotal ?? 0) - (totals._sum.amountPaid ?? 0)),
  );

  const byStatus = await db.clientInvoice.groupBy({
    by: ["status"],
    _sum: { grandTotal: true },
    _count: true,
  });
  console.log("\n--- Invoices by status ---");
  for (const s of byStatus) {
    console.log(`  ${s.status.padEnd(10)}  ${s._count} invoices  ${fmt(s._sum.grandTotal ?? 0)}`);
  }

  const topInv = await db.clientInvoice.findMany({
    orderBy: { grandTotal: "desc" },
    take: 5,
    include: { client: true, project: true },
  });
  console.log("\n--- Top 5 invoices ---");
  for (const i of topInv) {
    console.log(
      `  ${i.invoiceNo.padEnd(24)}  ${fmt(i.grandTotal)}  ${i.status.padEnd(8)}  ${i.client.name.slice(0, 40)}`,
    );
  }

  const stockTotal = await db.material.aggregate({
    _sum: { onHandQty: true },
    _count: true,
  });
  console.log("\n--- Stock materials ---");
  console.log("  count:", stockTotal._count);

  const topStock = await db.material.findMany({
    orderBy: [{ avgUnitCost: "desc" }],
    take: 5,
    select: { sku: true, name: true, onHandQty: true, avgUnitCost: true },
  });
  console.log("\n--- Top 5 most expensive materials ---");
  for (const m of topStock) {
    console.log(`  ${m.sku.padEnd(28)}  qty ${String(m.onHandQty).padStart(6)} · ${fmt(m.avgUnitCost)}  ${m.name.slice(0, 40)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
