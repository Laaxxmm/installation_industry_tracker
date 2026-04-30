// Core time-entry business logic shared between Server Actions (web UI) and
// REST routes (mobile). No Next.js-specific calls (revalidatePath, etc.) —
// the callers add those around these primitives.

import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma, TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";
import { minutesBetween } from "@/lib/time";

export const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per photo
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Clients may send a clock timestamp when replaying an offline op. We trust
// it only if it's within this window. The previous 24h cap was wide enough
// for anti-fraud concerns (an employee could backdate a punch to claim a
// missed shift). 5 minutes is enough for normal client-clock skew + brief
// offline replays; anything older falls back to server `now()` so a
// supervisor has to make the correction explicitly.
const CLIENT_CLOCK_TRUST_MS = 5 * 60 * 1000;

export function resolveClientClock(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return new Date();
  const drift = Math.abs(Date.now() - t.getTime());
  return drift > CLIENT_CLOCK_TRUST_MS ? new Date() : t;
}

export async function savePunchPhotos(entryId: string, files: File[]): Promise<string[]> {
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

export async function removePunchPhotoDir(entryId: string): Promise<void> {
  const dir = join(process.cwd(), "public", "uploads", "punch", entryId);
  await rm(dir, { recursive: true, force: true }).catch(() => {
    /* tolerate missing dir — the DB record is the source of truth. */
  });
}

export interface PunchInParams {
  userId: string;
  projectId: string;
  lat?: number | null;
  lng?: number | null;
  clockInIso?: string | null;
}

export async function punchInCore(params: PunchInParams) {
  const open = await db.timeEntry.findFirst({
    where: {
      employeeId: params.userId,
      status: TimeEntryStatus.OPEN,
      clockOut: null,
    },
  });
  if (open) throw new Error("You are already clocked in. Punch out or switch first.");

  try {
    return await db.timeEntry.create({
      data: {
        employeeId: params.userId,
        projectId: params.projectId,
        clockIn: resolveClientClock(params.clockInIso),
        status: TimeEntryStatus.OPEN,
        geoInLat: params.lat ?? null,
        geoInLng: params.lng ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("You are already clocked in. Punch out or switch first.");
    }
    throw err;
  }
}

export interface PunchOutParams {
  userId: string;
  entryId: string;
  photos: File[];
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
  clockOutIso?: string | null;
}

export async function punchOutCore(params: PunchOutParams) {
  const entry = await db.timeEntry.findUnique({ where: { id: params.entryId } });
  if (!entry) throw new Error("Entry not found");
  if (entry.employeeId !== params.userId) {
    throw new Error("Forbidden");
  }
  if (entry.status !== TimeEntryStatus.OPEN) throw new Error("Entry is not open");

  const photoUrls = await savePunchPhotos(entry.id, params.photos);
  if (photoUrls.length === 0) {
    throw new Error("Please upload at least one photo of the work done.");
  }

  const clockOut = resolveClientClock(params.clockOutIso);
  const minutes = minutesBetween(entry.clockIn, clockOut);
  const note =
    params.note && params.note.trim() !== "" ? params.note.slice(0, 500) : null;

  return db.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockOut,
      minutes,
      note,
      geoOutLat: Number.isFinite(params.lat ?? NaN) ? params.lat : null,
      geoOutLng: Number.isFinite(params.lng ?? NaN) ? params.lng : null,
      photoUrls,
    },
  });
}

export interface SwitchProjectParams {
  userId: string;
  projectId: string;
  atIso?: string | null;
}

export async function switchProjectCore(params: SwitchProjectParams) {
  const open = await db.timeEntry.findFirst({
    where: {
      employeeId: params.userId,
      status: TimeEntryStatus.OPEN,
      clockOut: null,
    },
  });
  const at = resolveClientClock(params.atIso);
  try {
    return await db.$transaction(async (tx) => {
      if (open) {
        await tx.timeEntry.update({
          where: { id: open.id },
          data: { clockOut: at, minutes: minutesBetween(open.clockIn, at) },
        });
      }
      return tx.timeEntry.create({
        data: {
          employeeId: params.userId,
          projectId: params.projectId,
          clockIn: at,
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
}

export async function submitPeriodCore(userId: string): Promise<{ submitted: number }> {
  const result = await db.timeEntry.updateMany({
    where: {
      employeeId: userId,
      status: TimeEntryStatus.OPEN,
      clockOut: { not: null },
    },
    data: { status: TimeEntryStatus.SUBMITTED },
  });
  return { submitted: result.count };
}
