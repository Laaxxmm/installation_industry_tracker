import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mobileError, revokeMobileSession } from "@/server/mobile-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  refreshToken: z.string().min(20),
});

// Best-effort logout: revoke the refresh token so the device can no longer
// rotate. Access tokens expire on their own inside 15 minutes.
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }
    await revokeMobileSession(parsed.data.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileError(err);
  }
}
