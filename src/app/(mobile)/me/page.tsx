import { subDays } from "date-fns";
import { TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { formatIST } from "@/lib/time";
import { Code } from "@/components/sab/Code";
import { Pill } from "@/components/sab/Pill";
import { getOpenEntry } from "@/server/queries/open-entry";
import { SubmitPeriodButton } from "./SubmitPeriodButton";

function fmtHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function statusTone(
  s: TimeEntryStatus,
): "ink" | "positive" | "alert" | "amber" | "blue" {
  switch (s) {
    case "APPROVED":
      return "positive";
    case "REJECTED":
      return "alert";
    case "SUBMITTED":
      return "blue";
    case "OPEN":
      return "amber";
    default:
      return "ink";
  }
}

export default async function MyTimesheetPage() {
  const session = await requireSession();
  const openEntry = await getOpenEntry(session.user.id);
  const isLive = !!openEntry;

  const since = subDays(new Date(), 45);
  const entries = await db.timeEntry.findMany({
    where: { employeeId: session.user.id, clockIn: { gte: since } },
    include: { project: { select: { code: true, name: true } } },
    orderBy: { clockIn: "desc" },
  });

  const readyToSubmit = entries.filter(
    (e) => e.status === "OPEN" && e.clockOut,
  ).length;
  const totalMinutes = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const approvedMinutes = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((s, e) => s + (e.minutes ?? 0), 0);

  const eyebrowColor = isLive ? "text-white/55" : "text-sab-ink-3";
  const headingColor = isLive ? "text-white" : "text-sab-ink";
  const mutedText = isLive ? "text-white/55" : "text-sab-ink-3";
  const tileClass = isLive
    ? "rounded-[12px] border border-white/10 bg-white/[0.05] p-[14px]"
    : "rounded-[12px] border border-sab-rule bg-sab-card p-[14px]";
  const rowBorder = isLive ? "border-white/8" : "border-sab-rule";
  const bigValue = isLive ? "text-white" : "text-sab-ink";
  const codeColor = isLive ? "oklch(0.68 0.16 45)" : "oklch(0.42 0.14 45)";

  return (
    <div className="pb-6">
      {/* Greeting */}
      <div className="px-5 pb-4 pt-4">
        <div className={`sab-eyebrow ${eyebrowColor}`}>
          Timesheet · Last 45 days
        </div>
        <h1
          className={`mt-1 font-sab-sans text-[22px] font-semibold tracking-[-0.025em] ${headingColor}`}
        >
          Your hours
        </h1>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 px-4">
        <div className={tileClass}>
          <div className={`sab-eyebrow ${mutedText}`}>Logged</div>
          <div
            className={`mt-1 font-sab-mono text-[20px] font-medium tabular-nums tracking-[-0.02em] ${bigValue}`}
          >
            {fmtHHMM(totalMinutes)}
          </div>
          <div className={`mt-[2px] font-sab-mono text-[10px] ${mutedText}`}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </div>
        </div>
        <div className={tileClass}>
          <div className={`sab-eyebrow ${mutedText}`}>Approved</div>
          <div
            className="mt-1 font-sab-mono text-[20px] font-medium tabular-nums tracking-[-0.02em]"
            style={{ color: "oklch(0.62 0.16 155)" }}
          >
            {fmtHHMM(approvedMinutes)}
          </div>
          <div className={`mt-[2px] font-sab-mono text-[10px] ${mutedText}`}>
            Billable labor
          </div>
        </div>
      </div>

      {/* Ready-to-submit callout */}
      {readyToSubmit > 0 && (
        <div className="mt-4 px-4">
          <div
            className={
              "flex items-center justify-between rounded-[12px] p-4 " +
              (isLive
                ? "border border-sab-accent/30 bg-sab-accent/10"
                : "border border-sab-accent/25 bg-sab-accent/5")
            }
          >
            <div className="min-w-0">
              <div className="sab-eyebrow text-sab-accent">
                Ready for review
              </div>
              <div
                className={`mt-[2px] font-sab-sans text-[13.5px] font-semibold ${headingColor}`}
              >
                {readyToSubmit} closed{" "}
                {readyToSubmit === 1 ? "entry" : "entries"}
              </div>
            </div>
            <SubmitPeriodButton />
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="mt-5 px-5">
        <div
          className={`sab-eyebrow mb-2 ${mutedText}`}
        >
          All entries
        </div>
        {entries.length === 0 ? (
          <p className={`py-8 text-center font-sab-sans text-[12px] ${mutedText}`}>
            No entries yet.
          </p>
        ) : (
          <ul>
            {entries.map((e) => {
              const mins = e.minutes ?? 0;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return (
                <li
                  key={e.id}
                  className={`border-t py-[10px] ${rowBorder}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-sab-mono text-[10.5px] ${mutedText} w-12 flex-none`}
                    >
                      {formatIST(e.clockIn, "EEE dd")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Code style={{ color: codeColor }}>
                          {e.project.code}
                        </Code>
                        <Pill tone={statusTone(e.status)}>{e.status}</Pill>
                      </div>
                      <div
                        className={`mt-[3px] font-sab-mono text-[10px] ${mutedText}`}
                      >
                        {formatIST(e.clockIn, "HH:mm")} →{" "}
                        {e.clockOut ? formatIST(e.clockOut, "HH:mm") : "—"}
                      </div>
                    </span>
                    <span
                      className={`font-sab-mono text-[13px] font-semibold tabular-nums ${bigValue}`}
                    >
                      {e.clockOut ? `${h}h ${String(m).padStart(2, "0")}m` : "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
