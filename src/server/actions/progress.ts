"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "decimal.js";
import {
  MilestoneStatus,
  Prisma,
  ProjectStageKey,
  Role,
} from "@prisma/client";
import { db } from "@/server/db";
import {
  AuthorizationError,
  requireSession,
  hasRole,
} from "@/server/rbac";
import {
  MilestoneInput,
  MilestonePercentInput,
  StageDatesInput,
} from "@/lib/validators";

/**
 * Progress RBAC: MANAGER+ can edit any project; SUPERVISOR can edit only
 * projects they are assigned to as siteSupervisor.
 */
async function assertCanEditProgress(projectId: string) {
  const session = await requireSession();
  if (hasRole(session, [Role.ADMIN, Role.MANAGER])) return session;
  if (session.user.role === Role.SUPERVISOR) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { siteSupervisorId: true },
    });
    if (project?.siteSupervisorId === session.user.id) return session;
  }
  throw new AuthorizationError("Cannot update progress on this project");
}

function clampPercent(raw: string | number | Prisma.Decimal): Prisma.Decimal {
  const d = new Prisma.Decimal(typeof raw === "string" ? raw : raw.toString());
  const bounded = d.lessThan(0)
    ? new Prisma.Decimal(0)
    : d.greaterThan(100)
      ? new Prisma.Decimal(100)
      : d;
  return bounded.toDecimalPlaces(2);
}

/**
 * Recompute stage actualStart/actualEnd from its child milestones:
 *  - actualStart = first non-zero percent milestone start (earliest plannedStart among IN_PROGRESS/DONE)
 *  - actualEnd   = when every child is 100% → now; otherwise cleared.
 */
async function refreshStageFromMilestones(
  tx: Prisma.TransactionClient,
  projectId: string,
  stageKey: ProjectStageKey,
) {
  const siblings = await tx.projectMilestone.findMany({
    where: { projectId, stageKey },
    select: { percentComplete: true, status: true, updatedAt: true },
  });
  if (siblings.length === 0) return;

  const anyStarted = siblings.some((m) =>
    new Decimal(m.percentComplete.toString()).greaterThan(0),
  );
  const allDone = siblings.every((m) =>
    new Decimal(m.percentComplete.toString()).greaterThanOrEqualTo(100),
  );

  const stage = await tx.projectStage.findUnique({
    where: { projectId_stageKey: { projectId, stageKey } },
    select: { actualStart: true, actualEnd: true },
  });

  const patch: Prisma.ProjectStageUpdateInput = {};
  if (anyStarted && !stage?.actualStart) patch.actualStart = new Date();
  if (allDone && !stage?.actualEnd) patch.actualEnd = new Date();
  if (!allDone && stage?.actualEnd) patch.actualEnd = null;

  if (Object.keys(patch).length > 0) {
    await tx.projectStage.update({
      where: { projectId_stageKey: { projectId, stageKey } },
      data: patch,
    });
  }
}

/**
 * Ensure the 5 fixed ProjectStage rows exist for a project. Safe to call
 * multiple times — upserts missing rows without touching existing ones.
 */
export async function ensureProjectStages(projectId: string) {
  await requireSession();
  const STAGE_KEYS: ProjectStageKey[] = [
    ProjectStageKey.SURVEY,
    ProjectStageKey.DELIVERY,
    ProjectStageKey.INSTALL,
    ProjectStageKey.COMMISSION,
    ProjectStageKey.HANDOVER,
  ];
  await db.$transaction(async (tx) => {
    for (const stageKey of STAGE_KEYS) {
      await tx.projectStage.upsert({
        where: { projectId_stageKey: { projectId, stageKey } },
        create: { projectId, stageKey },
        update: {},
      });
    }
  });
}

export async function upsertMilestone(raw: unknown) {
  const input = MilestoneInput.parse(raw);
  const session = await assertCanEditProgress(input.projectId);

  const data: Prisma.ProjectMilestoneUncheckedCreateInput = {
    projectId: input.projectId,
    stageKey: input.stageKey,
    sortOrder: input.sortOrder,
    name: input.name,
    plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
    plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
    weight: new Prisma.Decimal(input.weight),
    updatedByUserId: session.user.id,
  };

  let milestoneId: string;
  if (input.id) {
    const updated = await db.projectMilestone.update({
      where: { id: input.id },
      data: {
        name: data.name,
        stageKey: data.stageKey,
        sortOrder: data.sortOrder,
        plannedStart: data.plannedStart,
        plannedEnd: data.plannedEnd,
        weight: data.weight,
        updatedByUserId: session.user.id,
      },
    });
    milestoneId = updated.id;
  } else {
    const created = await db.projectMilestone.create({ data });
    milestoneId = created.id;
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: input.id ? "UPDATE" : "CREATE",
      entity: "ProjectMilestone",
      entityId: milestoneId,
    },
  });
  revalidatePath(`/projects/${input.projectId}/progress`);
  revalidatePath(`/projects/${input.projectId}`);
  return { milestoneId };
}

export async function deleteMilestone(milestoneId: string) {
  const existing = await db.projectMilestone.findUnique({
    where: { id: milestoneId },
    select: { projectId: true, stageKey: true },
  });
  if (!existing) throw new Error("Milestone not found");
  const session = await assertCanEditProgress(existing.projectId);

  await db.$transaction(async (tx) => {
    await tx.projectMilestone.delete({ where: { id: milestoneId } });
    await refreshStageFromMilestones(tx, existing.projectId, existing.stageKey);
  });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE",
      entity: "ProjectMilestone",
      entityId: milestoneId,
    },
  });
  revalidatePath(`/projects/${existing.projectId}/progress`);
  revalidatePath(`/projects/${existing.projectId}`);
}

/** Hot path — supervisor-friendly. Updates percent + optional status, auto-derives status if omitted. */
export async function updateMilestonePercent(raw: unknown) {
  const input = MilestonePercentInput.parse(raw);
  const existing = await db.projectMilestone.findUnique({
    where: { id: input.milestoneId },
    select: {
      projectId: true,
      stageKey: true,
      status: true,
      actualStart: true,
      actualEnd: true,
    },
  });
  if (!existing) throw new Error("Milestone not found");
  const session = await assertCanEditProgress(existing.projectId);

  const percent = clampPercent(input.percentComplete);
  const pct = new Decimal(percent.toString());

  let status: MilestoneStatus;
  if (input.status) {
    status = input.status as MilestoneStatus;
  } else if (pct.greaterThanOrEqualTo(100)) {
    status = MilestoneStatus.DONE;
  } else if (pct.greaterThan(0)) {
    status = MilestoneStatus.IN_PROGRESS;
  } else {
    status = existing.status === MilestoneStatus.BLOCKED
      ? MilestoneStatus.BLOCKED
      : MilestoneStatus.PENDING;
  }

  const now = new Date();
  const actualStart =
    !existing.actualStart && pct.greaterThan(0) ? now : existing.actualStart;
  const actualEnd =
    pct.greaterThanOrEqualTo(100)
      ? (existing.actualEnd ?? now)
      : null;

  await db.$transaction(async (tx) => {
    await tx.projectMilestone.update({
      where: { id: input.milestoneId },
      data: {
        percentComplete: percent,
        status,
        actualStart,
        actualEnd,
        updatedByUserId: session.user.id,
      },
    });
    await refreshStageFromMilestones(tx, existing.projectId, existing.stageKey);
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_PERCENT",
      entity: "ProjectMilestone",
      entityId: input.milestoneId,
    },
  });
  revalidatePath(`/projects/${existing.projectId}/progress`);
  revalidatePath(`/projects/${existing.projectId}`);
}

export async function updateStageDates(raw: unknown) {
  const input = StageDatesInput.parse(raw);
  const session = await assertCanEditProgress(input.projectId);

  await db.projectStage.upsert({
    where: {
      projectId_stageKey: {
        projectId: input.projectId,
        stageKey: input.stageKey,
      },
    },
    create: {
      projectId: input.projectId,
      stageKey: input.stageKey,
      plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
      plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
      notes: input.notes ?? null,
    },
    update: {
      plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
      plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
      notes: input.notes ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_STAGE",
      entity: "ProjectStage",
      entityId: `${input.projectId}:${input.stageKey}`,
    },
  });
  revalidatePath(`/projects/${input.projectId}/progress`);
  revalidatePath(`/projects/${input.projectId}`);
}
