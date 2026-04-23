import { TimeEntryStatus } from "@prisma/client";
import { subDays } from "date-fns";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { getOpenEntry } from "@/server/queries/open-entry";
import { signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/sab/Pill";

function fmtHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function roleLabel(role: string): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "MANAGER":
      return "Manager";
    case "SUPERVISOR":
      return "Site supervisor";
    case "EMPLOYEE":
      return "Field employee";
    default:
      return role;
  }
}

export default async function ProfilePage() {
  const session = await requireSession();
  const openEntry = await getOpenEntry(session.user.id);
  const isLive = !!openEntry;

  const since = subDays(new Date(), 30);
  const recent = await db.timeEntry.findMany({
    where: { employeeId: session.user.id, clockIn: { gte: since } },
    select: { status: true, minutes: true, clockOut: true },
  });
  const totals = {
    logged: recent.reduce((s, e) => s + (e.minutes ?? 0), 0),
    openCount: recent.filter((e) => e.status === "OPEN" && e.clockOut).length,
    approved: recent.filter((e) => e.status === TimeEntryStatus.APPROVED).length,
    rejected: recent.filter((e) => e.status === TimeEntryStatus.REJECTED).length,
  };

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const user = session.user;
  const initials = (user.name ?? "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";

  const eyebrow = isLive ? "text-white/55" : "text-sab-ink-3";
  const heading = isLive ? "text-white" : "text-sab-ink";
  const muted = isLive ? "text-white/55" : "text-sab-ink-3";
  const tileClass = isLive
    ? "rounded-[12px] border border-white/10 bg-white/[0.05] p-[14px]"
    : "rounded-[12px] border border-sab-rule bg-sab-card p-[14px]";
  const rowBorder = isLive ? "border-white/10" : "border-sab-rule";

  return (
    <div className="pb-10">
      {/* Header card */}
      <div className="px-5 pb-4 pt-4">
        <div className={`sab-eyebrow ${eyebrow}`}>Profile</div>
        <h1
          className={`mt-1 font-sab-sans text-[22px] font-semibold tracking-[-0.025em] ${heading}`}
        >
          Your account
        </h1>
      </div>

      <div className="px-4">
        <div className={`${tileClass} flex items-center gap-3`}>
          <span
            className={
              "flex h-12 w-12 flex-none items-center justify-center rounded-full font-sab-sans text-[15px] font-semibold " +
              (isLive
                ? "bg-white/15 text-white"
                : "bg-sab-paper-alt text-sab-ink")
            }
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className={`truncate font-sab-sans text-[15px] font-semibold ${heading}`}
            >
              {user.name ?? "—"}
            </div>
            <div
              className={`mt-[2px] truncate font-sab-mono text-[11px] ${muted}`}
            >
              {user.email ?? "—"}
            </div>
            <div className="mt-[6px]">
              <Pill tone={isLive ? "amber" : "ink"}>
                {roleLabel(user.role ?? "EMPLOYEE")}
              </Pill>
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4 px-4">
        <div className={tileClass}>
          <div className={`sab-eyebrow ${muted}`}>Current status</div>
          <div
            className={`mt-[2px] font-sab-sans text-[13.5px] font-semibold ${heading}`}
          >
            {isLive ? "Clocked in" : "Off the clock"}
          </div>
          {isLive && openEntry ? (
            <div className={`mt-1 font-sab-mono text-[11px] ${muted}`}>
              Since {new Date(openEntry.clockIn).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* 30-day KPIs */}
      <div className="mt-5 px-5">
        <div className={`sab-eyebrow mb-2 ${muted}`}>Last 30 days</div>
        <dl className={`grid grid-cols-2 gap-x-4 border-t ${rowBorder}`}>
          {[
            { k: "Logged", v: fmtHHMM(totals.logged) },
            { k: "Entries", v: String(recent.length) },
            { k: "Approved", v: String(totals.approved) },
            { k: "Rejected", v: String(totals.rejected) },
          ].map((row) => (
            <div
              key={row.k}
              className={`flex items-baseline justify-between border-b py-[10px] ${rowBorder}`}
            >
              <dt className={`font-sab-sans text-[12px] ${muted}`}>{row.k}</dt>
              <dd
                className={`font-sab-mono text-[13px] font-semibold tabular-nums ${heading}`}
              >
                {row.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Actions */}
      <div className="mt-6 px-4">
        <form action={handleSignOut}>
          <Button
            type="submit"
            variant="outline"
            className={
              "h-11 w-full rounded-[10px] font-sab-sans text-[14px] font-semibold " +
              (isLive
                ? "border-white/15 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                : "border-sab-rule bg-sab-card text-sab-ink hover:bg-sab-paper-alt")
            }
          >
            Sign out
          </Button>
        </form>
      </div>

      {/* Footer meta */}
      <div className="mt-6 px-5">
        <p className={`text-center font-sab-mono text-[10px] ${muted}`}>
          SAB Tracker · v0.1 · {user.id.slice(0, 8)}
        </p>
      </div>
    </div>
  );
}
