import { Role, TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { TimesheetsTable, type TimesheetEntry } from "./TimesheetsTable";
import { TimesheetsStatusFilter } from "./TimesheetsStatusFilter";
import { TableSearchInput } from "@/components/sab/TableFilters";

const VALID_STATUS = new Set([
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ALL",
] as const);

export default async function TimesheetsApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
  ]);
  const sp = await searchParams;
  const rawStatus = sp.status?.toUpperCase() ?? "SUBMITTED";
  const statusFilter =
    rawStatus && VALID_STATUS.has(rawStatus as typeof VALID_STATUS extends Set<infer T> ? T : never)
      ? rawStatus
      : "SUBMITTED";
  const q = sp.q?.trim() ?? "";

  const statusWhere =
    statusFilter === "ALL"
      ? {
          status: {
            in: [
              TimeEntryStatus.SUBMITTED,
              TimeEntryStatus.APPROVED,
              TimeEntryStatus.REJECTED,
            ],
          },
        }
      : { status: statusFilter as TimeEntryStatus };

  const searchWhere = q
    ? {
        OR: [
          { employee: { name: { contains: q, mode: "insensitive" as const } } },
          { project: { code: { contains: q, mode: "insensitive" as const } } },
          { project: { name: { contains: q, mode: "insensitive" as const } } },
          { note: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const entries = await db.timeEntry.findMany({
    where:
      session.user.role === Role.SUPERVISOR
        ? {
            ...statusWhere,
            ...searchWhere,
            project: { siteSupervisorId: session.user.id },
          }
        : { ...statusWhere, ...searchWhere },
    orderBy: { clockIn: "desc" },
    take: 200,
    select: {
      id: true,
      clockIn: true,
      clockOut: true,
      minutes: true,
      status: true,
      note: true,
      photoUrls: true,
      employee: { select: { name: true } },
      project: { select: { code: true, name: true } },
    },
  });

  const totalMinutes = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;

  const rows: TimesheetEntry[] = entries.map((e) => ({
    id: e.id,
    clockInIso: e.clockIn.toISOString(),
    clockOutIso: e.clockOut ? e.clockOut.toISOString() : null,
    minutes: e.minutes,
    status: e.status,
    employeeName: e.employee.name ?? "—",
    projectCode: e.project.code,
    projectName: e.project.name,
    note: e.note,
    photoUrls: e.photoUrls,
  }));

  const canDelete =
    session.user.role === Role.ADMIN || session.user.role === Role.MANAGER;

  const headerBody =
    statusFilter === "SUBMITTED"
      ? `${entries.length} submitted · ${hh}h ${mm}m awaiting review`
      : `${entries.length} ${statusFilter.toLowerCase()} · ${hh}h ${mm}m`;

  const sectionLabel =
    statusFilter === "SUBMITTED"
      ? "Submitted entries"
      : statusFilter === "APPROVED"
        ? "Approved entries"
        : statusFilter === "REJECTED"
          ? "Rejected entries"
          : "All entries";

  return (
    <div>
      <PageHeader
        eyebrow="Approvals"
        title="Timesheets"
        description={headerBody}
        actions={<TimesheetsStatusFilter current={statusFilter} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search employee, project, or note…"
          width={300}
        />
        {q && (
          <span className="text-[11px] text-slate-500">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"} match
          </span>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="text-[14px] font-semibold text-slate-900">
            {sectionLabel}
          </div>
          <div className="text-[11px] text-slate-500">
            {statusFilter === "SUBMITTED"
              ? "Approve or reject to finalize labor cost"
              : "Use Unapprove to move an entry back to Submitted"}
          </div>
        </div>
        <TimesheetsTable entries={rows} canDelete={canDelete} />
      </div>
    </div>
  );
}
