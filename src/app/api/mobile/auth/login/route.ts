import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import {
  createMobileSession,
  mobileError,
  signAccessToken,
} from "@/server/mobile-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().min(4).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials payload" },
        { status: 400 },
      );
    }
    const { email, password, deviceId } = parsed.data;

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
