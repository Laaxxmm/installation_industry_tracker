import Link from "next/link";
import { Plus } from "lucide-react";
import { InvoiceStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { istFyLabel } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectsTable, type ProjectRow } from "./ProjectsTable";
import { ProjectsDashboard } from "./ProjectsDashboard";
import { ProjectsMainFilter } from "./ProjectsMainFilter";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ description?: string }>;
}) {
  const session = await requireSession();
  const canCreate = hasRole(session, [Role.ADMIN, Role.MANAGER]);
  const sp = await searchParams;
  const selectedDescription = sp.description ?? "";

  const where =
    session.user.role === Role.SUPERVISOR
      ? { siteSupervisorId: session.user.id }
      : {};

  const [projects, statusGroups, billedSums] = await Promise.all([
    db.project.findMany({
      where,
      take: 500,
      orderBy: [{ poDate: "desc" }, { createdAt: "desc" }],
    }),
    db.project.groupBy({
      where,
      by: ["status"],
      _count: { _all: true },
    }),
    db.clientInvoice.groupBy({
      by: ["projectId"],
      where: { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] } },
      _sum: { grandTotal: true },
    }),
  ]);

  const billedByProject = new Map<string, string>(
    billedSums.map((b) => [b.projectId, (b._sum.grandTotal ?? "0").toString()]),
  );

  const countOf = (s: string) =>
    statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const totalCount = statusGroups.reduce((a, g) => a + g._count._all, 0);
  const activeCount = countOf("ACTIVE");
  const holdCount = countOf("ON_HOLD");
  const completedCount = countOf("COMPLETED");

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    fileNo: p.fileNo,
    poNumber: p.poNumber,
    poDate: p.poDate ? p.poDate.toISOString() : null,
    fy: p.poDate ? istFyLabel(p.poDate) : null,
    poStatus: p.poStatus,
    clientName: p.clientName,
    location: p.location,
    description: p.description,
    projectDetails: p.projectDetails,
    workStatus: p.workStatus,
    contractValue: p.contractValue.toString(),
    billedValue: billedByProject.get(p.id) ?? "0",
    adjBillableValue: p.adjBillableValue.toString(),
    response: p.response,
  }));

  const descriptionOptions = Array.from(
    new Set(
      rows
        .map((r) => r.description?.trim())
        .filter((d): d is string => !!d && d.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const scopedRows = selectedDescription
    ? rows.filter((r) => (r.description ?? "").trim() === selectedDescription)
    : rows;

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        description={`${totalCount} total · ${activeCount} active · ${holdCount} on hold · ${completedCount} completed`}
        actions={
          canCreate ? (
            <Link href="/projects/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New project
              </Button>
            </Link>
          ) : null
        }
      />
      <ProjectsMainFilter
        options={descriptionOptions}
        current={selectedDescription}
      />
      <ProjectsDashboard rows={scopedRows} />
      <ProjectsTable rows={scopedRows} />
      {rows.length >= 500 && totalCount > rows.length && (
        <div className="mt-2 text-center text-[11px] text-slate-500">
          Showing the 500 most recent projects ({totalCount} total).
        </div>
      )}
    </div>
  );
}
