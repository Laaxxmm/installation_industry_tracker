/* eslint-disable no-console */
// Backfill: for each project with billedValue > 0 AND a linked client,
// create one ISSUED ClientInvoice whose grandTotal equals billedValue,
// with 0% GST (lump-sum historical billing — no tax split).
//
// Skips projects that already have any ClientInvoice (idempotent re-run safe).
// Run: node scripts/raise-invoices-from-billed.mjs

import crypto from "crypto";
import { PrismaClient, InvoiceKind, InvoiceStatus, Role } from "@prisma/client";

const db = new PrismaClient();

function formatInvoiceNo(year, seq) {
  return `SAB-INV-${year}-${String(seq).padStart(4, "0")}`;
}

async function reserveInvoiceNos(year, count) {
  const row = await db.clientInvoiceNumberSequence.upsert({
    where: { year },
    create: { year, next: count + 1 },
    update: { next: { increment: count } },
  });
  return row.next - count;
}

async function main() {
  const admin = await db.user.findFirst({
    where: { role: { in: [Role.ADMIN, Role.MANAGER] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true },
  });
  if (!admin) throw new Error("No ADMIN/MANAGER user found to own invoices");
  console.log(`Invoice owner: ${admin.email} (${admin.role})`);

  const projects = await db.project.findMany({
    where: {
      billedValue: { gt: 0 },
      clientId: { not: null },
    },
    select: {
      id: true,
      code: true,
      clientId: true,
      billedValue: true,
      poDate: true,
      createdAt: true,
      clientInvoices: { select: { id: true } },
    },
    orderBy: { poDate: "asc" },
  });

  const eligible = projects.filter((p) => p.clientInvoices.length === 0);
  const skipped = projects.length - eligible.length;
  console.log(
    `Candidates: ${projects.length} (skipping ${skipped} that already have invoices)`,
  );
  console.log(`Will raise: ${eligible.length}`);

  const unlinked = await db.project.count({
    where: { billedValue: { gt: 0 }, clientId: null },
  });
  if (unlinked > 0) {
    console.log(`Note: ${unlinked} projects with billed>0 have no client; skipping.`);
  }

  if (eligible.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const year = new Date().getUTCFullYear();
  const startSeq = await reserveInvoiceNos(year, eligible.length);
  console.log(
    `Reserved invoice numbers ${formatInvoiceNo(year, startSeq)} … ${formatInvoiceNo(year, startSeq + eligible.length - 1)}`,
  );

  let created = 0;
  for (let i = 0; i < eligible.length; i++) {
    const p = eligible[i];
    const invoiceNo = formatInvoiceNo(year, startSeq + i);
    const issuedAt = p.poDate ?? p.createdAt;
    const grandTotal = p.billedValue;
    const shareToken = crypto.randomBytes(32).toString("hex");

    await db.clientInvoice.create({
      data: {
        invoiceNo,
        kind: InvoiceKind.PROGRESS,
        status: InvoiceStatus.ISSUED,
        projectId: p.id,
        clientId: p.clientId,
        placeOfSupplyStateCode: "29",
        issuedAt,
        subtotal: grandTotal,
        cgst: "0",
        sgst: "0",
        igst: "0",
        taxTotal: "0",
        grandTotal,
        amountPaid: "0",
        notes: "Historical billing imported from Format.xlsx — lump-sum, no GST split.",
        createdById: admin.id,
        shareToken,
        lines: {
          create: [
            {
              sortOrder: 0,
              description: "Historical billing (imported)",
              quantity: "1",
              unit: "Lot",
              unitPrice: grandTotal,
              discountPct: "0",
              gstRatePct: "0",
              lineSubtotal: grandTotal,
              lineTax: "0",
              lineTotal: grandTotal,
            },
          ],
        },
      },
    });
    created++;
  }

  console.log(`Created ${created} invoices.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
