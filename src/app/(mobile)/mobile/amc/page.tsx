import Link from "next/link";
import { AMCVisitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { formatIST } from "@/lib/time";
import { Code } from "@/components/sab/Code";
import { Pill } from "@/components/sab";

const VISIT_TONE: Record<AMCVisitStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  SCHEDULED: "blue",
  IN_PROGRESS: "amber",
  COMPLETED: "positive",
  MISSED: "alert",
  CANCELLED: "ink",
};

export default async function MobileAMCPage() {
  const session = await requireSession();

  // Today + the next 14 days of visits assigned to me (or unassigned).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const visits = await db.aMCVisit.findMany({
    where: {
      scheduledDate: { gte: today, lte: horizon },
      status: { in: [AMCVisitStatus.SCHEDULED, AMCVisitStatus.IN_PROGRESS] },
      OR: [{ assignedToUserId: session.user.id }, { assignedToUserId: null }],
    },
    orderBy: { scheduledDate: "asc" },
    include: { amc: { select: { contractNo: true, title: true, siteAddress: true } } },
    take: 50,
  });

  return (
    <div className="pb-6">
      <div className="px-5 pb-4 pt-4">
        <div className="sab-eyebrow text-sab-ink-3">After-sales</div>
        <h1 className="mt-1 font-sab-sans text-[22px] font-semibold tracking-[-0.025em]">
          AMC visits
        </h1>
        <p className="mt-1 font-sab-sans text-[12.5px] text-sab-ink-3">
          Today + next 14 days
        </p>
      </div>

      {visits.length === 0 ? (
        <div className="px-5 py-10 text-center font-sab-sans text-[13px] text-sab-ink-3">
          Nothing scheduled.
        </div>
      ) : (
        <ul className="px-4 grid gap-2">
          {visits.map((v) => (
            <li key={v.id}>
              <Link
                href={`/mobile/amc/${v.id}`}
                className="block rounded border px-3 py-2.5"
                style={{
                  borderColor: "hsl(var(--border))",
                  background: "hsl(var(--card))",
                  textDecoration: "none",
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="font-sab-sans text-[13.5px] font-semibold">
                      {v.amc.title}
                    </div>
                    <div
                      className="font-sab-mono text-[10px] mt-0.5"
                      style={{ color: "var(--sab-ink3)" }}
                    >
                      <Code>{v.amc.contractNo}</Code> · visit #{v.visitNo}
                    </div>
                    <div className="font-sab-sans text-[12px] mt-1" style={{ color: "var(--sab-ink2)" }}>
                      {v.amc.siteAddress}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <Pill tone={VISIT_TONE[v.status]} size="sm">
                      {v.status}
                    </Pill>
                    <div className="font-sab-mono text-[10.5px] mt-1" style={{ color: "var(--sab-ink3)" }}>
                      {formatIST(v.scheduledDate, "EEE dd MMM")}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
