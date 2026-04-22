/* eslint-disable no-console */
// One-shot: for every material, set openingQty = onHandQty + totalIssued - totalReceived.
// i.e. reverse-derive the opening balance from the running onHandQty and the
// receipt/issue history. Run once right after adding the openingQty column.
//
// Usage:
//   node scripts/backfill-opening-qty.mjs          (apply)
//   node scripts/backfill-opening-qty.mjs --dry    (preview)

import { PrismaClient } from "@prisma/client";
import { Decimal } from "decimal.js";

const db = new PrismaClient();

async function main() {
  const dry = process.argv.includes("--dry");

  const [materials, receiptAgg, issueAgg] = await Promise.all([
    db.material.findMany({
      select: { id: true, sku: true, onHandQty: true, openingQty: true },
    }),
    db.stockReceipt.groupBy({ by: ["materialId"], _sum: { qty: true } }),
    db.stockIssue.groupBy({ by: ["materialId"], _sum: { qty: true } }),
  ]);

  const recMap = new Map(
    receiptAgg.map((r) => [r.materialId, new Decimal(r._sum.qty?.toString() ?? 0)]),
  );
  const issMap = new Map(
    issueAgg.map((r) => [r.materialId, new Decimal(r._sum.qty?.toString() ?? 0)]),
  );

  let updated = 0;
  for (const m of materials) {
    const onHand = new Decimal(m.onHandQty.toString());
    const receipts = recMap.get(m.id) ?? new Decimal(0);
    const issues = issMap.get(m.id) ?? new Decimal(0);
    const opening = onHand.minus(receipts).plus(issues);
    if (!dry) {
      await db.material.update({
        where: { id: m.id },
        data: { openingQty: opening.toDecimalPlaces(3).toString() },
      });
    }
    updated++;
  }
  console.log(`${dry ? "Would update" : "Updated"} ${updated} materials.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
