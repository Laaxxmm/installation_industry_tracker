/* eslint-disable no-console */
// Adjusts Material.openingAvgCost so that recomputeRunningBalance
// (chronological replay of receipts + issues) lands at the target
// avgUnitCost. Also writes the target value to avgUnitCost directly.
//
// Math: moving-average is a linear function of openingAvgCost (X):
//   avg_final = a*X + b   (issues don't touch avg; receipts update it)
// After simulating symbolically with a=1, b=0, solve:
//   X = (target - b) / a
//
// Usage:
//   node scripts/override-avg-cost.mjs --sku STK-0001 --target 43
//   node scripts/override-avg-cost.mjs --sku STK-0001 --target 43 --dry

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

Decimal.set({ precision: 40 });

const db = new PrismaClient();

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--dry") {
      out.dry = true;
      continue;
    }
    if (a.startsWith("--")) {
      out[a.slice(2)] = process.argv[++i];
    }
  }
  if (!out.sku) throw new Error("--sku is required");
  if (!out.target) throw new Error("--target is required");
  return out;
}

async function main() {
  const { sku, target, dry } = parseArgs();
  const targetDec = new Decimal(target);

  const mat = await db.material.findUnique({
    where: { sku },
    select: {
      id: true,
      sku: true,
      name: true,
      openingQty: true,
      openingAvgCost: true,
      onHandQty: true,
      avgUnitCost: true,
    },
  });
  if (!mat) throw new Error(`Material not found: ${sku}`);

  const [receipts, issues] = await Promise.all([
    db.stockReceipt.findMany({
      where: { materialId: mat.id },
      orderBy: { receivedAt: "asc" },
      select: { qty: true, unitCost: true, receivedAt: true },
    }),
    db.stockIssue.findMany({
      where: { materialId: mat.id },
      orderBy: { issuedAt: "asc" },
      select: { qty: true, issuedAt: true },
    }),
  ]);

  const events = [
    ...receipts.map((r) => ({
      at: r.receivedAt,
      kind: "receipt",
      qty: new Decimal(r.qty.toString()),
      unitCost: new Decimal(r.unitCost.toString()),
    })),
    ...issues.map((i) => ({
      at: i.issuedAt,
      kind: "issue",
      qty: new Decimal(i.qty.toString()),
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Symbolic replay: avg = a*X + b; qty is concrete.
  let qty = new Decimal(mat.openingQty.toString());
  let a = new Decimal(1);
  let b = new Decimal(0);

  for (const e of events) {
    if (e.kind === "receipt") {
      const newQty = qty.plus(e.qty);
      if (newQty.gt(0)) {
        // new_avg = (qty * (a*X + b) + rq * ru) / newQty
        a = qty.times(a).div(newQty);
        b = qty.times(b).plus(e.qty.times(e.unitCost)).div(newQty);
      }
      qty = newQty;
    } else {
      qty = qty.minus(e.qty);
    }
  }

  // Solve targetDec = a*X + b  =>  X = (target - b) / a
  if (a.isZero()) {
    throw new Error(
      "Cannot solve: openingAvgCost has no effect on final avg (coefficient is zero). " +
        "This happens when opening qty fully depleted before any receipt.",
    );
  }
  const newOpening = targetDec.minus(b).div(a);

  console.log(`SKU:              ${mat.sku}  (${mat.name})`);
  console.log(`Opening qty:      ${mat.openingQty.toString()}`);
  console.log(`Receipts/issues:  ${receipts.length} / ${issues.length}`);
  console.log(`Final qty:        ${qty.toDecimalPlaces(3).toString()}`);
  console.log(`Current opening avg: ${mat.openingAvgCost.toString()}`);
  console.log(`Current avgUnitCost: ${mat.avgUnitCost.toString()}`);
  console.log(`Coefficients:     avg = ${a.toFixed(8)} * X + ${b.toFixed(8)}`);
  console.log(
    `Target avg ${targetDec.toString()}  =>  new openingAvgCost = ${newOpening.toFixed(6)}`,
  );

  if (newOpening.lt(0)) {
    console.warn(
      "WARNING: computed openingAvgCost is negative. " +
        "Target may be unreachable with current receipt history.",
    );
  }

  if (dry) {
    console.log("\n(dry run — no changes written)");
    return;
  }

  await db.material.update({
    where: { id: mat.id },
    data: {
      openingAvgCost: newOpening.toDecimalPlaces(4).toString(),
      avgUnitCost: targetDec.toDecimalPlaces(4).toString(),
    },
  });
  console.log("\nUpdated openingAvgCost and avgUnitCost.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
