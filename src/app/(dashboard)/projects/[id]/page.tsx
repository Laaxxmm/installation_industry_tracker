import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { formatINR, sum } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { isOverdue, projectPercentComplete } from "@/lib/progress";
import { ProjectTabs } from "./ProjectTabs";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      status: true,
      contractValue: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      siteSupervisorId: true,
      siteSupervisor: { select: { id: true, name: true } },
      budgetLines: {
        select: { id: true, total: true },
      },
      milestones: {
        select: { percentComplete: true, weight: true, status: true, plannedEnd: true },
      },
    },
  });
  if (!project) notFound();
  if (
    session.user.role === Role.SUPERVISOR &&
    project.siteSupervisorId !== session.user.id
  ) {
    notFound();
  }

  const canEditBudget = hasRole(session, [Role.ADMIN, Role.MANAGER]);
  const budgetTotal = sum(project.budgetLines.map((l) => l.total));
  const overall = projectPercentComplete(project.milestones);
  const overdueCount = project.milestones.filter((m) => isOverdue(m)).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono text-[11px] font-semibold tracking-normal text-brand">
              {project.code}
            </span>
            <StatusBadge status={project.status} />
          </span>
        }
        title={project.name}
        description={`Client · ${project.clientName}`}
        actions={
          canEditBudget ? (
            <Link href={`/projects/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-3.5 w-3.5" /> Edit project
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Contract value"
          value={formatINR(project.contractValue)}
        />
        <StatCard
          label="Progress"
          value={`${overall.toFixed(1)}%`}
          sub={
            overdueCount > 0
              ? `${overdueCount} overdue`
              : `${project.milestones.length} milestones`
          }
        />
        <StatCard
          label="Planned budget"
          value={formatINR(budgetTotal)}
          sub={`${project.budgetLines.length} line items`}
        />
        <StatCard
          label="Site supervisor"
          value={
            project.siteSupervisor?.name ? (
              <span className="text-[16px]">{project.siteSupervisor.name}</span>
            ) : (
              <span className="text-[16px] text-slate-400">— unassigned —</span>
            )
          }
        />
        <StatCard
          label="Timeline"
          value={
            <span className="text-[13px] font-medium">
              {project.startDate ? formatIST(project.startDate, "dd MMM yy") : "—"}
              <span className="mx-1.5 text-slate-400">→</span>
              {project.endDate ? formatIST(project.endDate, "dd MMM yy") : "—"}
            </span>
          }
        />
      </div>

      <ProjectTabs projectId={id} />

      <div className="mt-5 rounded-md border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <div className="text-[14px] font-semibold text-slate-900">Details</div>
        </div>
        <dl className="grid gap-x-8 gap-y-3 px-5 py-4 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Created
            </dt>
            <dd className="mt-0.5 text-slate-900">{formatIST(project.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Start date
            </dt>
            <dd className="mt-0.5 text-slate-900">
              {project.startDate ? formatIST(project.startDate, "dd-MM-yyyy") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              End date
            </dt>
            <dd className="mt-0.5 text-slate-900">
              {project.endDate ? formatIST(project.endDate, "dd-MM-yyyy") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Budget lines
            </dt>
            <dd className="mt-0.5 text-slate-900">{project.budgetLines.length}</dd>
          </div>
          {canEditBudget && (
            <div className="sm:col-span-2">
              <Link
                href={`/projects/${id}/budget`}
                className="text-[13px] font-medium text-brand hover:underline"
              >
                Manage budget →
              </Link>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
