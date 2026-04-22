import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ProjectStageKey, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIST } from "@/lib/time";
import {
  isOverdue,
  projectPercentComplete,
  stagePercentComplete,
} from "@/lib/progress";
import { ensureProjectStages } from "@/server/actions/progress";
import { ProjectTabs } from "../ProjectTabs";
import { StageStrip } from "./StageStrip";
import { MilestoneRow } from "./MilestoneRow";
import { NewMilestoneForm } from "./NewMilestoneForm";
import { StageDatesForm } from "./StageDatesForm";

const STAGE_LABELS: Record<ProjectStageKey, string> = {
  SURVEY: "Site Survey",
  DELIVERY: "Delivery",
  INSTALL: "Installation",
  COMMISSION: "Commissioning",
  HANDOVER: "Handover",
};

const STAGE_ORDER: ProjectStageKey[] = [
  ProjectStageKey.SURVEY,
  ProjectStageKey.DELIVERY,
  ProjectStageKey.INSTALL,
  ProjectStageKey.COMMISSION,
  ProjectStageKey.HANDOVER,
];

export default async function ProjectProgressPage({
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
      siteSupervisorId: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!project) notFound();

  if (
    session.user.role === Role.SUPERVISOR &&
    project.siteSupervisorId !== session.user.id
  ) {
    notFound();
  }

  // Self-heal: ensure the 5 stage rows exist for legacy projects.
  await ensureProjectStages(project.id);

  const [stages, milestones] = await Promise.all([
    db.projectStage.findMany({ where: { projectId: project.id } }),
    db.projectMilestone.findMany({
      where: { projectId: project.id },
      orderBy: [{ stageKey: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: { updatedBy: { select: { name: true } } },
    }),
  ]);

  const canEdit =
    hasRole(session, [Role.ADMIN, Role.MANAGER]) ||
    (session.user.role === Role.SUPERVISOR &&
      project.siteSupervisorId === session.user.id);

  const overall = projectPercentComplete(milestones);
  const overdue = milestones.filter((m) => isOverdue(m));
  const done = milestones.filter((m) => m.status === "DONE").length;

  const stagesByKey = new Map(stages.map((s) => [s.stageKey, s]));
  const milestonesByStage = new Map<ProjectStageKey, typeof milestones>();
  for (const k of STAGE_ORDER) milestonesByStage.set(k, []);
  for (const m of milestones) {
    milestonesByStage.get(m.stageKey)?.push(m);
  }

  const stageSummaries = STAGE_ORDER.map((key) => {
    const stage = stagesByKey.get(key)!;
    const ms = milestonesByStage.get(key) ?? [];
    return {
      stageKey: key,
      label: STAGE_LABELS[key],
      stage,
      milestones: ms,
      percent: stagePercentComplete(ms),
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/projects/${project.id}`} className="hover:text-brand">
            {project.code}
          </Link>
        }
        title={project.name}
        description={project.clientName}
      />
      <div className="mb-5">
        <ProjectTabs projectId={project.id} />
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall progress"
          value={`${overall.toFixed(1)}%`}
          sub={`${done} of ${milestones.length} done`}
        />
        <StatCard
          label="Milestones"
          value={milestones.length}
          sub={`${STAGE_ORDER.length} stages`}
        />
        <StatCard
          label="Overdue"
          value={
            <span className={overdue.length > 0 ? "text-red-700" : undefined}>
              {overdue.length}
            </span>
          }
          sub={overdue.length > 0 ? "needs attention" : "all on track"}
        />
        <StatCard
          label="Timeline"
          value={
            <span className="text-[13px] font-medium">
              {project.startDate
                ? formatIST(project.startDate, "dd MMM yy")
                : "—"}
              <span className="mx-1.5 text-slate-400">→</span>
              {project.endDate ? formatIST(project.endDate, "dd MMM yy") : "—"}
            </span>
          }
        />
      </div>

      <StageStrip stages={stageSummaries} />

      {overdue.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-900 shadow-card">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-semibold">
              {overdue.length} overdue milestone
              {overdue.length === 1 ? "" : "s"}
            </div>
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {overdue.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <span className="font-medium">{m.name}</span>
                  <span className="mx-1 text-red-500">·</span>
                  {STAGE_LABELS[m.stageKey]}
                  <span className="mx-1 text-red-500">·</span>
                  due {m.plannedEnd ? formatIST(m.plannedEnd, "dd-MM-yyyy") : "—"}
                </li>
              ))}
              {overdue.length > 5 && (
                <li className="text-[11px] italic">
                  and {overdue.length - 5} more
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {stageSummaries.map(({ stageKey, label, stage, milestones: ms, percent }) => (
          <Card key={stageKey}>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-slate-600">
                    {percent.toFixed(1)}%
                  </span>
                </span>
              </CardTitle>
              <CardDescription>
                {stage.plannedStart || stage.plannedEnd ? (
                  <>
                    Planned{" "}
                    {stage.plannedStart
                      ? formatIST(stage.plannedStart, "dd-MM-yyyy")
                      : "—"}
                    {" → "}
                    {stage.plannedEnd
                      ? formatIST(stage.plannedEnd, "dd-MM-yyyy")
                      : "—"}
                  </>
                ) : (
                  "No dates set"
                )}
                {stage.actualStart && (
                  <>
                    <span className="mx-2">·</span>Started{" "}
                    {formatIST(stage.actualStart, "dd-MM-yyyy")}
                  </>
                )}
                {stage.actualEnd && (
                  <>
                    <span className="mx-2">·</span>Completed{" "}
                    {formatIST(stage.actualEnd, "dd-MM-yyyy")}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canEdit && (
                <StageDatesForm
                  projectId={project.id}
                  stageKey={stageKey}
                  initial={{
                    plannedStart: stage.plannedStart
                      ? formatIST(stage.plannedStart, "yyyy-MM-dd")
                      : "",
                    plannedEnd: stage.plannedEnd
                      ? formatIST(stage.plannedEnd, "yyyy-MM-dd")
                      : "",
                    notes: stage.notes ?? "",
                  }}
                />
              )}
              {ms.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500">
                  No milestones yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {ms.map((m) => (
                    <MilestoneRow
                      key={m.id}
                      milestone={{
                        id: m.id,
                        name: m.name,
                        percentComplete: m.percentComplete.toString(),
                        weight: m.weight.toString(),
                        status: m.status,
                        plannedStart: m.plannedStart
                          ? m.plannedStart.toISOString()
                          : null,
                        plannedEnd: m.plannedEnd
                          ? m.plannedEnd.toISOString()
                          : null,
                        updatedAt: m.updatedAt.toISOString(),
                        updatedByName: m.updatedBy?.name ?? null,
                      }}
                      projectId={project.id}
                      stageKey={stageKey}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              )}
              {canEdit && (
                <NewMilestoneForm
                  projectId={project.id}
                  stageKey={stageKey}
                  nextSortOrder={ms.length}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
