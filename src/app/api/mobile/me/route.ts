import { NextResponse, type NextRequest } from "next/server";
import { TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";
import { mobileError, requireMobileAuth } from "@/server/mobile-auth";

export const runtime = "nodejs";

// Bootstrap payload the native app fetches right after login (and on cold
// start). One round-trip delivers everything needed to render the punch
// screen offline-first.
export async function GET(req: NextRequest) {
  try {
    const session = await requireMobileAuth(req);
    const [openEntry, projects] = await Promise.all([
      db.timeEntry.findFirst({
        where: {
          employeeId: session.user.id,
          status: TimeEntryStatus.OPEN,
          clockOut: null,
        },
        include: { project: { select: { id: true, code: true, name: true } } },
      }),
      db.project.findMany({
        where: { status: { in: ["ACTIVE", "DRAFT"] } },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
    ]);

    return NextResponse.json({
      user: session.user,
      openEntry: openEntry
        ? {
            id: openEntry.id,
            projectId: openEntry.projectId,
            projectCode: openEntry.project.code,
            projectName: openEntry.project.name,
            clockInIso: openEntry.clockIn.toISOString(),
          }
        : null,
      projects,
      serverTimeIso: new Date().toISOString(),
      minClientVersion: "0.1.0",
    });
  } catch (err) {
    return mobileError(err);
  }
}
