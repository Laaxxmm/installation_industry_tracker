"use server";

import { revalidatePath } from "next/cache";
import { Role, TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  requireSession,
  requireRole,
  canApproveTimesheetEntry,
  AuthorizationError,
} from "@/server/rbac";
import { PunchInInput } from "@/lib/validators";
import {
  punchInCore,
  punchOutCore,
  switchProjectCore,
  submitPeriodCore,
  removePunchPhotoDir,
} from "@/server/services/time";

export async function punchIn(raw: unknown) {
  const session = await requireSession();
  const input = PunchInInput.parse(raw);
  const entry = await punchInCore({
    userId: session.user.id,
    projectId: input.projectId,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  });
  revalidatePath("/punch");
  revalidatePath("/me");
  return entry;
}

export async function punchOut(formData: FormData) {
  const session = await requireSession();
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) throw new Error("Missing entryId");
  const latStr = formData.get("lat");
  const lngStr = formData.get("lng");
  const noteStr = formData.get("note");
  const lat =
    typeof latStr === "string" && latStr !== "" ? Number(latStr) : null;
  const lng =
    typeof lngStr === "string" && lngStr !== "" ? Number(lngStr) : null;
  const note = typeof noteStr === "string" ? noteStr : null;
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File);

  // Pre-check ownership so we surface a clean 403-style error before
  // the service layer throws a bare "Forbidden".
  const entry = await db.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Entry not found");
  if (entry.employeeId !== session.user.id) throw new AuthorizationError();

  const updated = await punchOutCore({
    userId: session.user.id,
    entryId,
    photos,
    lat,
    lng,
    note,
  });
  revalidatePath("/punch");
  revalidatePath("/me");
  return { id: updated.id };
}

export async function switchProject(projectId: string) {
  const session = await requireSession();
  await switchProjectCore({ userId: session.user.id, projectId });
  revalidatePath("/punch");
  revalidatePath("/me");
}

export async function submitPeriod() {
  const session = await requireSession();
  await submitPeriodCore(session.user.id);
  revalidatePath("/me");
}

export async function approveEntries(entryIds: string[]) {
  const session = await requireSession();
  for (const id of entryIds) {
    await canApproveTimesheetEntry(id);
    await db.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.APPROVED,
        approverId: session.user.id,
        approvedAt: new Date(),
      },
    });
  }
  revalidatePath("/timesheets");
}

export async function rejectEntries(entryIds: string[]) {
  const session = await requireSession();
  for (const id of entryIds) {
    await canApproveTimesheetEntry(id);
    await db.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.REJECTED,
        approverId: session.user.id,
        approvedAt: new Date(),
      },
    });
  }
  revalidatePath("/timesheets");
}

export async function unapproveEntry(entryId: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const entry = await db.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Entry not found");
  if (
    entry.status !== TimeEntryStatus.APPROVED &&
    entry.status !== TimeEntryStatus.REJECTED
  ) {
    throw new Error("Only APPROVED or REJECTED entries can be moved back to SUBMITTED.");
  }
  await db.timeEntry.update({
    where: { id: entryId },
    data: {
      status: TimeEntryStatus.SUBMITTED,
      approverId: null,
      approvedAt: null,
    },
  });
  revalidatePath("/timesheets");
  revalidatePath("/me");
}

export async function deleteTimeEntry(entryId: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const entry = await db.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Entry not found");
  if (
    entry.status === TimeEntryStatus.OPEN ||
    entry.status === TimeEntryStatus.APPROVED
  ) {
    throw new Error(
      "Cannot delete an open or already-approved entry. Close or reject it first.",
    );
  }
  if (entry.photoUrls.length > 0) {
    await removePunchPhotoDir(entry.id);
  }
  await db.timeEntry.delete({ where: { id: entry.id } });
  revalidatePath("/timesheets");
  revalidatePath("/me");
}

export async function adminCloseOpenEntry(entryId: string) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const entry = await db.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.status !== TimeEntryStatus.OPEN) return;
  const now = new Date();
  const { minutesBetween } = await import("@/lib/time");
  await db.timeEntry.update({
    where: { id: entryId },
    data: { clockOut: now, minutes: minutesBetween(entry.clockIn, now) },
  });
  revalidatePath("/timesheets");
}
