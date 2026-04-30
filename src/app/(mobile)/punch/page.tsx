import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { startOfWeek } from "date-fns";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { APP_TZ, formatIST } from "@/lib/time";
import { getOpenEntry } from "@/server/queries/open-entry";
import { Code } from "@/components/sab/Code";
import { PunchWidget } from "./PunchWidget";

function greetingFor(now: Date): string {
  const hour = Number(formatInTimeZone(now, APP_TZ, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(full: string | null | undefined): string {
  if (!full) return "there";
  return full.split(/\s+/)[0] ?? full;
}

function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default async function PunchPage() {
  const session = await requireSession();
  if (session.user.role === Role.ADMIN) {
    redirect("/dashboard");
  }

  const now = new Date();
  const weekStart = startOfWeek(toZonedTime(now, APP_TZ), { weekStartsOn: 1 });

  const [openEntry, projects, weekEntries] = await Promise.all([
    getOpenEntry(session.user.id),
    db.project.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.timeEntry.findMany({
      where: {
        employeeId: session.user.id,
        clockIn: { gte: weekStart },
      },
      include: { project: { select: { code: true } } },
      orderBy: { clockIn: "desc" },
      take: 5,
    }),
  ]);

  const isLive = !!openEntry;
  const weekTotalMinutes = weekEntries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const dateLabel = isLive
    ? "On site · live"
    : formatInTimeZone(now, APP_TZ, "EEEE · dd MMM yy");
  const greeting = isLive
    ? `Punched in, ${firstName(session.user.name)}`
    : `${greetingFor(now)}, ${firstName(session.user.name)}`;

  const eyebrowColor = isLive ? "text-white/55" : "text-sab-ink-3";
  const headingColor = isLive ? "text-white" : "text-sab-ink";
  const mutedTitle = isLive ? "text-white/55" : "text-sab-ink-3";

  return (
    <div className="pb-6">
      {/* Greeting */}
      <div className="px-5 pb-4 pt-4">
        <div className={`sab-eyebrow ${eyebrowColor}`}>{dateLabel}</div>
        <h1
          className={`mt-1 font-sab-sans text-[22px] font-semibold tracking-[-0.025em] ${headingColor}`}
        >
          {greeting}
        </h1>
      </div>

      <PunchWidget
        openEntry={
          openEntry
            ? {
                id: openEntry.id,
                projectCode: openEntry.project.code,
                projectName: openEntry.project.name,
                clockInIso: openEntry.clockIn.toISOString(),
              }
            : null
        }
        projects={projects}
      />

      {/* This week */}
      <div className="px-5 pt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className={`sab-eyebrow ${mutedTitle}`}>This week</span>
          <span
            className={`font-sab-mono text-[10px] ${
              isLive ? "text-white/55" : "text-sab-ink-3"
            }`}
          >
            {fmtMinutes(weekTotalMinutes)}
          </span>
        </div>
        {weekEntries.length === 0 ? (
          <p
            className={`py-6 text-center font-sab-sans text-[12px] ${
              isLive ? "text-white/55" : "text-sab-ink-3"
            }`}
          >
            No entries yet this week.
          </p>
        ) : (
          <ul>
            {weekEntries.map((e) => {
              const mins = e.minutes ?? 0;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return (
                <li
                  key={e.id}
                  className={
                    "flex items-center gap-3 border-t py-[10px] " +
                    (isLive ? "border-white/8" : "border-sab-rule")
                  }
                >
                  <span
                    className={`font-sab-mono text-[10.5px] ${
                      isLive ? "text-white/60" : "text-sab-ink-3"
                    } w-11 flex-none`}
                  >
                    {formatIST(e.clockIn, "EEE dd")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Code
                      style={{
                        color: isLive
                          ? "oklch(0.68 0.16 45)"
                          : "oklch(0.42 0.14 45)",
                      }}
                    >
                      {e.project.code}
                    </Code>
                    <span
                      className={`mt-[2px] block font-sab-mono text-[10px] ${
                        isLive ? "text-white/55" : "text-sab-ink-3"
                      }`}
                    >
                      {e.status}
                    </span>
                  </span>
                  <span
                    className={`font-sab-mono text-[13px] font-semibold ${
                      isLive ? "text-white" : "text-sab-ink"
                    }`}
                  >
                    {e.clockOut ? `${h}h ${String(m).padStart(2, "0")}m` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
