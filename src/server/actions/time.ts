"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma, Role, TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  requireSession,
  requireRole,
  canApproveTimesheetEntry,
  AuthorizationError,
} from "@/server/rbac";
import { PunchInInput } from "@/lib/validators";
import { minutesBetween } from "@/lib/time";

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per photo
const MAX_PHOTOS = 10;

async function savePunchPhotos(entryId: string, files: File[]): Promise<string[]> {
  const valid = files.filter((f) => f instanceof File && f.size > 0);
  if (valid.length === 0) return [];
  if (valid.length > MAX_PHOTOS) {
    throw new Error(`Please upload at most ${MAX_PHOTOS} photos.`);
  }
  const uploadDir = join(process.cwd(), "public", "uploads", "punch", entryId);
  await mkdir(uploadDir, { recursive: true });
  const urls: string[] = [];
  for (const file of valid) {
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error(`"${file.name}" exceeds the 10 MB limit.`);
    }
    const mime = (file.type || "").toLowerCase();
    if (mime && !ALLOWED_IMAGE_MIME.has(mime)) {
      throw new Error(`"${file.name}" is not a supported image type.`);
    }
    const rawExt = file.name.includes(".") ? file.name.split(".").pop() : "";
    const ext = (rawExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const fname = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, fname), buffer);
    urls.push(`/uploads/punch/${entryId}/${fname}`);
  }
  return urls;
}

export async function punchIn(raw: unknown) {
  const session = await requireSession();
  const input = PunchInInput.parse(raw);

  // Verify the employee has no currently-running entry (clocked-in and not clocked-out).
  const open = await db.timeEntry.findFirst({
    where: {
      employeeId: session.user.id,
      status: TimeEntryStatus.OPEN,
      clockOut: null,
    },
  });
  if (open) throw new Error("You are already clocked in. Punch out or switch first.");

  try {
    const entry = await db.timeEntry.create({
      data: {
        employeeId: session.user.id,
        projectId: input.projectId,
        clockIn: new Date(),
        status: TimeEntryStatus.OPEN,
        geoInLat: input.lat ?? null,
        geoInLng: input.lng ?? null,
      },
    });
    revalidatePath("/punch");
    revalidatePath("/me");
    return entry;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("You are already clocked in. Punch out or switch first.");
    }
    throw err;
  }
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
  const note =
    typeof noteStr === "string" && noteStr.trim() !== "" ? noteStr.slice(0, 500) : null;
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);

  const entry = await db.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Entry not found");
  if (entry.employeeId !== session.user.id) throw new AuthorizationError();
  if (entry.status !== TimeEntryStatus.OPEN) throw new Error("Entry is not open");

  const photoUrls = await savePunchPhotos(entry.id, files);
  if (photoUrls.length === 0) {
    throw new Error("Please upload at least one photo of the work done.");
  }

  const now = new Date();
  const minutes = minutesBetween(entry.clockIn, now);

  const updated = await db.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockOut: now,
      minutes,
      note,
      geoOutLat: Number.isFinite(lat) ? lat : null,
      geoOutLng: Number.isFinite(lng) ? lng : null,
      photoUrls,
    },
  });
  revalidatePath("/punch");
  revalidatePath("/me");
  return { id: updated.id };
}

export async function switchProject(projectId: string) {
  const session = await requireSession();
  const open = await db.timeEntry.findFirst({
    where: {
      employeeId: session.user.id,
      status: TimeEntryStatus.OPEN,
      clockOut: null,
    },
  });
  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      if (open) {
        await tx.timeEntry.update({
          where: { id: open.id },
          data: { clockOut: now, minutes: minutesBetween(open.clockIn, now) },
        });
      }
      await tx.timeEntry.create({
        data: {
          employeeId: session.user.id,
          projectId,
          clockIn: now,
          status: TimeEntryStatus.OPEN,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(
        "Another session is already open. Refresh and punch out before switching.",
      );
    }
    throw err;
  }
  revalidatePath("/punch");
  revalidatePath("/me");
}

export async function submitPeriod() {
  const session = await requireSession();
  await db.timeEntry.updateMany({
    where: {
      employeeId: session.user.id,
      status: TimeEntryStatus.OPEN,
      clockOut: { not: null },
    },
    data: { status: TimeEntryStatus.SUBMITTED },
  });
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
    const dir = join(process.cwd(), "public", "uploads", "punch", entry.id);
    await rm(dir, { recursive: true, force: true }).catch(() => {
      /* tolerate missing dir — the DB record is the source of truth. */
    });
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
  await db.timeEntry.update({
    where: { id: entryId },
    data: { clockOut: now, minutes: minutesBetween(entry.clockIn, now) },
  });
  revalidatePath("/timesheets");
}
