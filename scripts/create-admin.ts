/* eslint-disable no-console */
// Bootstrap one ADMIN user. Used after `scripts/wipe-data.ts` to give the
// operator a way back into the app. Reads credentials from env vars so they
// never hit shell history or get committed.
//
// Usage:
//   ADMIN_EMAIL=you@yourcompany.com \
//   ADMIN_NAME="Your Full Name" \
//   ADMIN_PASSWORD='strong-password' \
//   DATABASE_URL='<railway-prod-url>' \
//   npx tsx scripts/create-admin.ts
//
// Behavior:
//   - Refuses to run if any of the three ADMIN_* vars is missing
//   - bcrypts password with rounds=10 (matches seed.ts and src/server/auth.ts)
//   - Uses upsert keyed by email — re-running just resets the password
//   - Sets active=true and role=ADMIN

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Env = z.object({
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_NAME: z.string().min(1, "ADMIN_NAME must be non-empty").max(100),
  ADMIN_PASSWORD: z
    .string()
    .min(8, "ADMIN_PASSWORD must be at least 8 characters")
    .max(200),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must be set"),
});

async function main(): Promise<void> {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    console.error("create-admin: invalid env. Set ADMIN_EMAIL, ADMIN_NAME,");
    console.error("              ADMIN_PASSWORD, and DATABASE_URL.");
    console.error();
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = parsed.data;

  const db = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await db.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        name: ADMIN_NAME,
        passwordHash,
        role: Role.ADMIN,
        active: true,
      },
      create: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash,
        role: Role.ADMIN,
        active: true,
      },
      select: { id: true, email: true, role: true, active: true },
    });
    console.log(
      `Created/updated admin: id=${user.id} email=${user.email} role=${user.role} active=${user.active}`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("create-admin failed:", err);
  process.exit(1);
});
