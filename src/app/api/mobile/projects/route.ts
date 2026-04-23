import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { mobileError, requireMobileAuth } from "@/server/mobile-auth";

export const runtime = "nodejs";

// Pure project list — used by the native app to refresh the picker without
// the full bootstrap payload (e.g. after a manual "Sync now" tap).
export async function GET(req: NextRequest) {
  try {
    await requireMobileAuth(req);
    const projects = await db.project.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, status: true },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    return mobileError(err);
  }
}
