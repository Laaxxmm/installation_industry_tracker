import { subDays } from "date-fns";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { formatIST } from "@/lib/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitPeriodButton } from "./SubmitPeriodButton";

export default async function MyTimesheetPage() {
  const session = await requireSession();

  const since = subDays(new Date(), 45);
  const entries = await db.timeEntry.findMany({
    where: { employeeId: session.user.id, clockIn: { gte: since } },
    include: { project: true },
    orderBy: { clockIn: "desc" },
  });

  const readyToSubmit = entries.filter(
    (e) => e.status === "OPEN" && e.clockOut,
  ).length;
  const totalMinutes = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const approvedMinutes = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((s, e) => s + (e.minutes ?? 0), 0);
  const approvedH = Math.floor(approvedMinutes / 60);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-3 shadow-card">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            Last 45d
          </div>
          <div className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-slate-900">
            {hh}h {mm}m
          </div>
          <div className="text-[10px] text-slate-500">
            {entries.length} entries
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3 shadow-card">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            Approved
          </div>
          <div className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-emerald-700">
            {approvedH}h
          </div>
          <div className="text-[10px] text-slate-500">Billable labor</div>
        </div>
      </div>

      {readyToSubmit > 0 && (
        <div className="flex items-center justify-between rounded-md border border-brand/20 bg-brand/5 p-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand/70">
              Ready for review
            </div>
            <div className="text-[13px] font-medium text-slate-900">
              {readyToSubmit} closed {readyToSubmit === 1 ? "entry" : "entries"}
            </div>
          </div>
          <SubmitPeriodButton />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My timesheet</CardTitle>
          <CardDescription>Last 45 days · IST</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">Day</th>
                <th className="px-2 py-2">Project</th>
                <th className="px-2 py-2">In</th>
                <th className="px-2 py-2">Out</th>
                <th className="px-4 py-2 text-right">Mins</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[12px] text-slate-500"
                  >
                    No entries yet.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-2 text-slate-800">
                    <div>{formatIST(e.clockIn, "EEE dd MMM")}</div>
                    <div className="mt-0.5">
                      <StatusBadge status={e.status} />
                    </div>
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px] font-medium text-brand">
                    {e.project.code}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-slate-600">
                    {formatIST(e.clockIn, "HH:mm")}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-slate-600">
                    {e.clockOut ? formatIST(e.clockOut, "HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {e.minutes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
