/* eslint-disable no-console */
import { PrismaClient, InvoiceStatus } from "@prisma/client";
const db = new PrismaClient();

function fmt(n) {
  return Number(n).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

async function main() {
  const now = new Date();
  console.log("Server now:", now.toISOString());
  console.log("Server local:", now.toString());

  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  console.log("Trend window start:", trendStart.toISOString(), "(12-month chart left edge)");

  const invoices = await db.clientInvoice.findMany({
    where: { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] } },
    select: { invoiceNo: true, issuedAt: true, grandTotal: true, status: true },
    orderBy: { issuedAt: "asc" },
  });
  console.log(`\nTotal ISSUED+PAID invoices: ${invoices.length}`);

  const buckets = new Map();
  let nullIssued = 0;
  let inWindow = 0;
  let before = 0;
  let after = 0;
  for (const i of invoices) {
    if (!i.issuedAt) {
      nullIssued++;
      continue;
    }
    const ym = `${i.issuedAt.getUTCFullYear()}-${String(i.issuedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(
      ym,
      (buckets.get(ym) ?? 0) + Number(i.grandTotal),
    );
    if (i.issuedAt < trendStart) before++;
    else if (i.issuedAt > now) after++;
    else inWindow++;
  }
  console.log(`  null issuedAt : ${nullIssued}`);
  console.log(`  before trend  : ${before}`);
  console.log(`  in window     : ${inWindow}`);
  console.log(`  future        : ${after}`);

  console.log("\nMonthly totals (UTC grouping):");
  for (const ym of [...buckets.keys()].sort()) {
    console.log(`  ${ym}  ${fmt(buckets.get(ym)).padStart(18)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
