import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/server/auth.config";

// Edge-safe NextAuth instance. We intentionally do NOT import `@/server/auth`
// here — that file pulls in `@prisma/client` and `bcryptjs`, which would
// force the middleware onto the Node runtime and load the entire Prisma
// bundle on every request (every page nav, every RSC prefetch, every asset
// not excluded by the matcher). Using the split config keeps middleware lean.
const { auth } = NextAuth(authConfig);

// Inline the Role values as plain strings so we don't import the Prisma
// client enum (which drags Prisma into the edge bundle).
type Role = "ADMIN" | "MANAGER" | "SUPERVISOR" | "EMPLOYEE";

// Route -> allowed roles (all authenticated if undefined in check below)
const ROLE_RULES: Array<{ pattern: RegExp; allow: Role[] }> = [
  { pattern: /^\/admin(\/|$)/, allow: ["ADMIN"] },
  { pattern: /^\/overhead(\/|$)/, allow: ["ADMIN", "MANAGER"] },
  { pattern: /^\/reports(\/|$)/, allow: ["ADMIN", "MANAGER"] },
  {
    pattern: /^\/inventory(\/|$)/,
    allow: ["ADMIN", "MANAGER", "SUPERVISOR"],
  },
  {
    pattern: /^\/timesheets(\/|$)/,
    allow: ["ADMIN", "MANAGER", "SUPERVISOR"],
  },
  {
    pattern: /^\/projects\/new$/,
    allow: ["ADMIN", "MANAGER"],
  },
  // Sales pipeline
  { pattern: /^\/quotes(\/|$)/, allow: ["ADMIN", "MANAGER"] },
  { pattern: /^\/invoices(\/|$)/, allow: ["ADMIN", "MANAGER"] },
  {
    pattern: /^\/clients(\/|$)/,
    allow: ["ADMIN", "MANAGER", "SUPERVISOR"],
  },
  // Work Order tab
  {
    pattern: /^\/projects\/[^/]+\/po(\/|$)/,
    allow: ["ADMIN", "MANAGER"],
  },
];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Public paths (no auth required)
  if (
    pathname === "/login" ||
    pathname.startsWith("/design") ||
    pathname.startsWith("/api/auth") ||
    // Mobile REST uses bearer JWTs, not the NextAuth cookie. Each handler
    // calls `requireMobileAuth` itself.
    pathname.startsWith("/api/mobile/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    // Client-facing share pages — capability-token protected, no session.
    pathname.startsWith("/q/") ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/api/pdf/public/")
  ) {
    return NextResponse.next();
  }

  const isAuthed = !!req.auth?.user;
  if (!isAuthed) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = req.auth!.user!.role as Role;

  for (const rule of ROLE_RULES) {
    if (rule.pattern.test(pathname) && !rule.allow.includes(userRole)) {
      return NextResponse.redirect(new URL("/forbidden", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Skip everything the middleware has no opinion on: all static assets
  // (`_next/*`, common file extensions), auth callbacks, the PDF streams
  // (already token-guarded), and public share routes. Narrowing the matcher
  // cuts the number of middleware invocations per navigation by an order
  // of magnitude, because Next triggers an RSC request per linked route
  // and each one would otherwise pay the auth() cost.
  matcher: [
    "/((?!api/auth|api/mobile|api/pdf/public|_next/static|_next/image|_next/data|favicon\\.ico|icons|manifest\\.webmanifest|q/|i/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|txt|woff2?|ttf|otf)$).*)",
  ],
};
