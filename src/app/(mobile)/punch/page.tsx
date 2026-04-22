import { redirect } from "next/navigation";
import { Role, TimeEntryStatus } from "@prisma/client";
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
import { PunchWidget } from "./PunchWidget";

export default async function PunchPage() {
  const session = await requireSession();
  // Allow any role to punch — supervisors/managers sometimes field-swap.
  if (session.user.role === Role.ADMIN) {
    redirect("/dashboard");
  }

  const [openEntry, projects] = await Promise.all([
    db.timeEntry.findFirst({
      where: {
        employeeId: session.user.id,
        status: TimeEntryStatus.OPEN,
        clockOut: null,
      },
      include: { project: true },
    }),
    db.project.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Status
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (openEntry ? "bg-emerald-500" : "bg-slate-400")
                }
              />
              <span className="text-[14px] font-semibold text-slate-900">
                {openEntry ? "Clocked in" : "Off the clock"}
              </span>
            </div>
          </div>
          {openEntry && (
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Since
              </div>
              <div className="mt-1 font-mono text-[14px] font-semibold tabular-nums text-slate-900">
                {formatIST(openEntry.clockIn, "HH:mm")}
              </div>
            </div>
          )}
        </div>
        {openEntry && (
          <div className="mt-3 rounded-md border border-brand/20 bg-brand/5 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand/70">
              Current project
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-[13px] font-semibold text-brand">
                {openEntry.project.code}
              </span>
              <span className="text-[12px] text-slate-700">
                {openEntry.project.name}
              </span>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Punch</CardTitle>
          <CardDescription>
            GPS captured on tap — denial won't block the clock.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
