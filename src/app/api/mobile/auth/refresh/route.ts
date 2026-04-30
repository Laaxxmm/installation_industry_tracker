import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import {
  mobileError,
  rotateMobileSession,
  signAccessToken,
} from "@/server/mobile-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  refreshToken: z.string().min(20),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit refresh by IP — a leaked refresh token is bearer auth, so
    // we can't key by user without first parsing+verifying the token. IP
    // throttling still cuts off rotation-exhaustion attacks at 30/min.
    const limit = rateLimit(`mob-refresh:ip:${clientIp(req)}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many refresh attempts. Try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
          },
        },
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing refreshToken" }, { status: 400 });
    }

    const rotated = await rotateMobileSession(parsed.data.refreshToken);
    const user = await db.user.findUnique({
      where: { id: rotated.userId },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!user || !user.active) {
      return NextResponse.json({ error: "User deactivated" }, { status: 401 });
    }

    const accessToken = await signAccessToken(user);
    return NextResponse.json({
      accessToken,
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.expiresAt.toISOString(),
    });
  } catch (err) {
    return mobileError(err);
  }
}
