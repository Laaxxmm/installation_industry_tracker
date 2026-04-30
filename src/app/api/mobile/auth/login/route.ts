import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import {
  createMobileSession,
  mobileError,
  signAccessToken,
} from "@/server/mobile-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().min(4).max(128),
});

export async function POST(req: NextRequest) {
  try {
    // IP-keyed first, before we even parse the body — stops a sprayer
    // from making us do the JSON.parse + Zod work on every shot.
    const ipLimit = rateLimit(`mob-login:ip:${clientIp(req)}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)),
          },
        },
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials payload" },
        { status: 400 },
      );
    }
    const { email, password, deviceId } = parsed.data;

    // Email-keyed limit: stops credential brute-force against a known account
    // even if the attacker rotates IPs.
    const emailLimit = rateLimit(`mob-login:email:${email.toLowerCase()}`, 5, 60_000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts for this account. Try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(emailLimit.retryAfterMs / 1000)),
          },
        },
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const accessToken = await signAccessToken(user);
    const { refreshToken, expiresAt } = await createMobileSession({
      userId: user.id,
      deviceId,
    });

    return NextResponse.json({
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return mobileError(err);
  }
}
