"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ProjectStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { ProjectInput } from "@/lib/validators";

function formatCode(year: number, seq: number): string {
  return `SAB-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextProjectCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const existing = await tx.projectCodeSequence.findUnique({ where: { year } });
  if (!existing) {
    await tx.projectCodeSequence.create({ data: { year, next: 2 } });
    return formatCode(year, 1);
  }
  const claimed = existing.next;
  await tx.projectCodeSequence.update({
    where: { year },
    data: { next: { increment: 1 } },
  });
  return formatCode(year, claimed);
}

export async function createProject(raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = ProjectInput.parse(raw);

  const project = await db.$transaction(async (tx) => {
    const code = await nextProjectCode(tx);
    return tx.project.create({
      data: {
        code,
        name: input.name,
        clientName: input.clientName,
        contractValue: input.contractValue,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        siteSupervisorId: input.siteSupervisorId ?? null,
        status: ProjectStatus.DRAFT,
        poDate: input.poDate ? new Date(input.poDate) : null,
        poStatus: input.poStatus ?? null,
        poNumber: input.poNumber ?? null,
        fileNo: input.fileNo ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
        projectDetails: input.projectDetails ?? null,
        workStatus: input.workStatus ?? null,
        billedValue: input.billedValue ?? "0",
        adjBillableValue: input.adjBillableValue ?? "0",
        response: input.response ?? null,
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "Project",
      entityId: project.id,
    },
  });
  revalidatePath("/projects");
  return project;
}

export async function updateProject(id: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const input = ProjectInput.parse(raw);

  const project = await db.project.update({
    where: { id },
    data: {
      name: input.name,
      clientName: input.clientName,
      contractValue: input.contractValue,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      siteSupervisorId: input.siteSupervisorId ?? null,
      poDate: input.poDate ? new Date(input.poDate) : null,
      poStatus: input.poStatus ?? null,
      poNumber: input.poNumber ?? null,
      fileNo: input.fileNo ?? null,
      location: input.location ?? null,
      description: input.description ?? null,
      projectDetails: input.projectDetails ?? null,
      workStatus: input.workStatus ?? null,
      billedValue: input.billedValue ?? "0",
      adjBillableValue: input.adjBillableValue ?? "0",
      response: input.response ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entity: "Project",
      entityId: id,
    },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return project;
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER]);
  const project = await db.project.update({ where: { id }, data: { status } });
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: `STATUS:${status}`,
      entity: "Project",
      entityId: id,
    },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return project;
}

export async function assignSupervisor(id: string, supervisorId: string | null) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  await db.project.update({ where: { id }, data: { siteSupervisorId: supervisorId } });
  revalidatePath(`/projects/${id}`);
}
