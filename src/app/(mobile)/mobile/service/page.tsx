import Link from "next/link";
import {
  ServiceCoverage,
  ServicePriority,
  ServiceStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { formatIST } from "@/lib/time";
import { Code } from "@/components/sab/Code";
import { Pill } from "@/components/sab";

const STATUS_TONE: Record<ServiceStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  NEW: "blue",
  TRIAGED: "blue",
  ASSIGNED: "amber",
  IN_PROGRESS: "amber",
  ON_HOLD: "ink",
  RESOLVED: "positive",
  VERIFIED: "positive",
  CLOSED: "ink",
  CANCELLED: "alert",
};

const PRIORITY_TONE: Record<ServicePriority, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  P1: "alert",
  P2: "amber",
  P3: "blue",
  P4: "ink",
};

const COVERAGE_TONE: Record<ServiceCoverage, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  AMC: "accent",
  WARRANTY: "positive",
  GOODWILL: "amber",
  BILLABLE: "ink",
};

export default async function MobileServiceListPage() {
  const session = await requireSession();

  // Open tickets assigned to me (or unassigned).
  const issues = await db.serviceIssue.findMany({
    where: {
      status: {
        in: [
          ServiceStatus.TRIAGED,
          ServiceStatus.ASSIGNED,
          ServiceStatus.IN_PROGRESS,
          ServiceStatus.ON_HOLD,
        ],
      },
      OR: [{ assignedToUserId: session.user.id }, { assignedToUserId: null }],
    },
    orderBy: [
      { priority: "asc" }, // P1 before P2 via enum ordering
      { reportedAt: "asc" },
    ],
    include: {
      client: { select: { name: true } },
    },
    take: 50,
  });

  return (
    <div className="pb-6">
      <div className="px-5 pb-4 pt-4">
        <div className="sab-eyebrow text-sab-ink-3">After-sales</div>
        <h1 className="mt-1 font-sab-sans text-[22px] font-semibold tracking-[-0.025em]">
          Service tickets
        </h1>
        <p className="mt-1 font-sab-sans text-[12.5px] text-sab-ink-3">
          Your open queue
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="px-5 py-10 text-center font-sab-sans text-[13px] text-sab-ink-3">
          Inbox zero. Nice.
        </div>
      ) : (
        <ul className="px-4 grid gap-2">
          {issues.map((i) => (
            <li
              key={i.id}
              className="rounded border"
              style={{
                borderColor: "hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            >
              <Link
                href={`/mobile/service/${i.id}`}
                className="block px-3 py-2.5"
                style={{ textDecoration: "none" }}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Pill tone={PRIORITY_TONE[i.priority]} size="sm">
                        {i.priority}
                      </Pill>
                      <Pill tone={COVERAGE_TONE[i.coverage]} size="sm">
                        {i.coverage}
                      </Pill>
                    </div>
                    <div className="font-sab-sans text-[13.5px] font-semibold line-clamp-2">
                      {i.summary}
                    </div>
                    <div
                      className="font-sab-mono text-[10px] mt-0.5"
                      style={{ color: "var(--sab-ink3)" }}
                    >
                      <Code>{i.ticketNo}</Code>
                    </div>
                    <div className="font-sab-sans text-[12px] mt-0.5" style={{ color: "var(--sab-ink2)" }}>
                      {i.client.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Pill tone={STATUS_TONE[i.status]} size="sm">
                      {i.status}
                    </Pill>
                    <div className="font-sab-mono text-[10.5px] mt-1" style={{ color: "var(--sab-ink3)" }}>
                      {formatIST(i.reportedAt, "dd MMM")}
                    </div>
                  </div>
                </div>
              </Link>
              {i.reportedByPhone && (
                <a
                  href={`tel:${i.reportedByPhone}`}
                  className="block border-t px-3 py-2 font-sab-mono text-[11.5px]"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--primary))",
                    textDecoration: "none",
                  }}
                >
                  📞 Call {i.reportedByName || i.reportedByPhone}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
