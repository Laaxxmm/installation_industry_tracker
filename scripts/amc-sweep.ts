/* eslint-disable no-console */
// Nightly after-sales sweep. Run via `tsx scripts/amc-sweep.ts` (schedule
// from host cron or a managed scheduler). Three things happen:
//
//   1. AMCs whose endDate has passed → status = EXPIRED.
//   2. AMCVisits still SCHEDULED >3 days after their scheduledDate → MISSED.
//   3. ServiceIssues with resolutionDueAt in the past and no breach stamp
//      yet → stamp slaBreachedAt = now (the dashboard lights them up).
//
// Every change writes an AuditLog entry so the human audit trail records
// the automated transition.

import {
  AMCStatus,
  AMCVisitStatus,
  PrismaClient,
  ServiceStatus,
} from "@prisma/client";

const db = new PrismaClient();

const TERMINAL_SERVICE = [ServiceStatus.CLOSED, ServiceStatus.CANCELLED];

async function expireAMCs(now: Date) {
  const candidates = await db.aMC.findMany({
    where: {
      status: AMCStatus.ACTIVE,
      endDate: { lt: now },
    },
    select: { id: true, contractNo: true },
  });

  for (const c of candidates) {
    await db.aMC.update({
      where: { id: c.id },
      data: { status: AMCStatus.EXPIRED },
    });
    await db.auditLog.create({
      data: {
        userId: null,
        action: "AUTO_EXPIRE",
        entity: "AMC",
        entityId: c.id,
      },
    });
    console.log(`  [AMC expired] ${c.contractNo}`);
  }
  return candidates.length;
}

async function markMissedVisits(now: Date) {
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const candidates = await db.aMCVisit.findMany({
    where: {
      status: AMCVisitStatus.SCHEDULED,
      scheduledDate: { lt: cutoff },
    },
    select: { id: true, amcId: true, visitNo: true },
  });

  for (const v of candidates) {
    await db.aMCVisit.update({
      where: { id: v.id },
      data: { status: AMCVisitStatus.MISSED },
    });
    await db.auditLog.create({
      data: {
        userId: null,
        action: "AUTO_MISSED",
        entity: "AMCVisit",
        entityId: v.id,
      },
    });
    console.log(`  [visit missed] amc=${v.amcId} visit#${v.visitNo}`);
  }
  return candidates.length;
}

async function flagBreachedTickets(now: Date) {
  const candidates = await db.serviceIssue.findMany({
    where: {
      status: { notIn: TERMINAL_SERVICE },
      resolutionDueAt: { lt: now },
      slaBreachedAt: null,
    },
    select: { id: true, ticketNo: true },
  });

  for (const t of candidates) {
    await db.serviceIssue.update({
      where: { id: t.id },
      data: { slaBreachedAt: now },
    });
    await db.auditLog.create({
      data: {
        userId: null,
        action: "SLA_BREACHED",
        entity: "ServiceIssue",
        entityId: t.id,
      },
    });
    console.log(`  [SLA breached] ${t.ticketNo}`);
  }
  return candidates.length;
}

async function main() {
  const now = new Date();
  console.log(`=== amc-sweep @ ${now.toISOString()} ===`);

  const expired = await expireAMCs(now);
  const missed = await markMissedVisits(now);
  const breached = await flagBreachedTickets(now);

  console.log(
    `sweep done: amcsExpired=${expired} visitsMissed=${missed} ticketsBreached=${breached}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
