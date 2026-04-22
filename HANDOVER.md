# SAB India Tracker — Claude Handover

**Transferred:** 2026-04-20 from a different machine. Read this before doing any work.

---

## 1. What this project is

SAB India is a fire-safety project tracker (internal tool). Stack:

- **Framework:** Next.js 15.1.3 (App Router) with route groups `(dashboard)` and `(public)`
- **DB:** PostgreSQL via Prisma 6 (schema in `prisma/schema.prisma`)
- **Auth:** NextAuth v5 beta (JWT strategy, Credentials provider, bcryptjs)
- **UI:** Tailwind + custom "Sapphire" design primitives (PageHeader, StatCard, StatusBadge, Card)
- **Money:** Decimal(14,2) via `decimal.js`; helpers in `src/lib/money.ts`
- **Time:** IST / financial-year helpers in `src/lib/time.ts` (`date-fns-tz`)
- **Tests:** Vitest (unit) + Playwright (e2e)
- **Exports:** `exceljs` streamed through `src/app/api/export/[kind]/route.ts`

Roles: `ADMIN | MANAGER | SUPERVISOR | EMPLOYEE`. RBAC helpers in `src/server/rbac.ts`.

## 2. What's DONE

The v1 tracker is live. Built features:

- Projects (CRUD, status, contract value, start/end, site supervisor)
- Budget lines per project (category: MATERIAL | LABOR | OTHER)
- Inventory (materials, stock issues, stock receipts, material transfers, direct purchases)
- Timesheets (clock in/out, rate cards, salaried vs hourly)
- Overhead allocations per project per month
- P&L engine (`src/lib/pnl.ts` pure core + `src/server/actions/pnl.ts` loader)
- Legacy `Invoice` model (project-scoped revenue lines; kept for back-compat)
- Role-gated dashboard
- XLSX exports

## 3. Most recent work — PERFORMANCE PASS (completed 2026-04-20)

User complaint: "entire app opening and switching of tabs is very slow". Root causes hit:

**Middleware was running on Node runtime, not Edge.** `src/middleware.ts` imported `auth` from `@/server/auth`, which transitively pulled `@prisma/client` and `bcryptjs`. Result: full Prisma bundle loaded on every request (every nav, every RSC prefetch, every un-excluded asset).

Fix applied (NextAuth v5 split-config pattern):
- New `src/server/auth.config.ts` — edge-safe, no Prisma/bcrypt imports
- `src/server/auth.ts` now spreads `authConfig` and only adds the Credentials provider (which needs Prisma + bcrypt)
- `src/middleware.ts` imports `authConfig` directly; inlines `Role` as string union to avoid pulling `@prisma/client`
- Middleware matcher tightened to skip `_next/data`, `api/pdf/public`, `/q/*`, `/i/*`, icons, manifest, common static asset extensions

**Next config:** added `experimental.staleTimes = { dynamic: 30, static: 180 }` in `next.config.mjs` so tab-back navigations replay cached payload.

**Query tightening across list pages + P&L:**
- `take: N` caps on every `findMany` (100–300 depending on page)
- Rollups moved to `groupBy` / `aggregate` instead of full-row fetches
- Slim `select` blocks replacing heavy `include: true`
- Stray `export const dynamic = "force-dynamic"` removed where redundant
- `src/server/actions/pnl.ts`: 11 sub-queries collapsed into one `Promise.all`; O(nxm) `.some()` dedup replaced with `Set`

**Dev mode:** `dev:turbo` script added to `package.json` (`next dev --turbo`). Use this instead of `npm run dev` for dev work — Turbopack compiles pages 3-10x faster than webpack.

Type-check clean: `npx tsc --noEmit` = exit 0.

## 4. What's NEXT — unstarted plan

`docs/plan-sales-pipeline-and-gst.md` contains a full implementation plan for the next phase: **Sales pipeline, project progress, GST-compliant invoicing**. Nothing in it has been built yet. Summary of scope:

- Clients module (`/clients`)
- Quotes module (`/quotes`) with DRAFT → SENT → NEGOTIATING → ACCEPTED → CONVERTED lifecycle, revisions, public share token
- On quote accept: auto-create Project + PurchaseOrder (Work Order) + seed budget lines from quote lines
- Project progress: 5 fixed stages (SURVEY/DELIVERY/INSTALL/COMMISSION/HANDOVER) + weighted milestones
- Client-facing GST invoicing (`/invoices`) with CGST/SGST/IGST math, line items, place-of-supply, amount-in-words
- PDF pipeline via `@react-pdf/renderer` for quotes, POs, tax invoices
- Public `/q/[token]` and `/i/[token]` unauthenticated share pages
- `ClientInvoice.grandTotal` folded into P&L revenue alongside legacy `Invoice.amount`

Phased delivery is laid out in §9 of the plan. Start with schema migrations.

Non-goals for v1: no email, no cron, no e-sign, no e-invoice/IRN API, no payment gateway.

## 5. Known loose ends

- **No git repo yet.** `git init` was never run. Consider initializing on the new laptop before any further work: `cd sab-india && git init && git add . && git commit -m "Transfer snapshot"`.
- **Missing asset:** `public/icons/icon-192.png` — referenced by the PWA manifest, file doesn't exist, dev server logs a 404. Harmless but worth creating an actual icon or removing the manifest reference.
- **`.env` is included in this transfer** at `sab-india/.env`. It contains `DATABASE_URL`, `NEXTAUTH_SECRET`, etc. Never commit it; `.gitignore` already covers it.
- **Database is NOT in this package.** See §6.

## 6. Database state

Local PostgreSQL on the source laptop — the data does **not** live in the project folder. **A full `pg_dump` of the source database is included** in this transfer as `sab_india.dump` (custom/compressed format, ~126 KB).

The dump contains **both schema and data** — every table from `prisma/schema.prisma` plus all the rows the user had entered (projects, inventory, timesheets, users, budget lines, overhead allocations, etc.).

**Restoring on the new laptop:**

```powershell
# 1. Make sure the dev server is NOT running (Ctrl+C it first) — open
#    Prisma connections will block or corrupt the restore.

# 2. Make sure the target DB exists. If not:
#    psql -U postgres -c "CREATE DATABASE sab_india;"

# 3. Restore. Use --clean --if-exists so it works whether the target DB is
#    empty or already has objects from a prior `prisma migrate deploy`.
$env:PGPASSWORD="postgres"    # or whatever the DATABASE_URL password is
& "C:\Program Files\PostgreSQL\<version>\bin\pg_restore.exe" `
    -h localhost -p 5432 -U postgres `
    -d sab_india --clean --if-exists `
    ".\sab_india.dump"         # adjust path to wherever the dump is
```

Find the right `<version>` by checking `C:\Program Files\PostgreSQL\` — pick the highest-numbered folder.

**CRITICAL — do NOT run these after the restore:**
- `npx prisma migrate deploy` — the dump already created all tables.
- `npm run db:seed` — the dump already has real user data; seeding would clash with existing rows or overwrite them.

The dump was taken from a Postgres 17 server. Restoring into Postgres 15/16/17 should all work (custom format is version-tolerant).

**Alternative option for ongoing two-laptop work** (not needed right now, but worth knowing): point `DATABASE_URL` on both laptops at a shared hosted Postgres (Neon, Supabase, Railway) and skip the dump entirely.

## 7. First-run on the new laptop

```bash
cd sab-india
# 1. install deps
npm install

# 2. make sure .env has a valid DATABASE_URL
# The .env in this folder points at localhost:5432 with user/password "postgres".
# If the new laptop's Postgres uses different credentials, edit DATABASE_URL first.

# 3. generate the prisma client (reads prisma/schema.prisma)
npx prisma generate

# 4. restore the dump (see §6 for the full command)
#    SKIP `prisma migrate deploy` and `db:seed` — the dump supplies both.

# 5. boot
npm run dev:turbo           # strongly preferred over `npm run dev`
```

Open http://localhost:3000 and log in with the credentials from the source laptop (same user table — the dump brought them over).

## 8. Repo layout quick reference

```
src/
  app/
    (dashboard)/      role-gated app shell + routes
    (public)/         unauthenticated share pages (when §4 is built)
    api/
      auth/           NextAuth route handlers
      export/[kind]/  XLSX stream
      pdf/            (future) PDF routes
  lib/
    money.ts          Decimal helpers + formatINR
    time.ts           IST + FY helpers
    pnl.ts            pure P&L core (no DB)
    gst.ts            (future) GST computation — see plan §3
    progress.ts       (future) milestone math — see plan §4
  server/
    auth.ts           full NextAuth (Prisma + bcrypt) — server-only
    auth.config.ts    edge-safe NextAuth config — imported by middleware
    db.ts             Prisma client singleton
    rbac.ts           requireSession / requireRole / can* helpers
    actions/          server actions per domain
    pdf/              (future) react-pdf documents — see plan §6
  middleware.ts       edge runtime; reads auth.config directly
prisma/
  schema.prisma
  seed.ts
tests/
  unit/               vitest
  e2e/                playwright
docs/
  plan-sales-pipeline-and-gst.md   the unstarted roadmap
```

## 9. House style

- Never use floats for money. Always `Decimal` from `decimal.js`, rounded at line boundary.
- Every server action starts with `requireSession()` or `requireRole(...)` then a domain-specific `can*` check.
- Use `revalidatePath` after mutations.
- Keep middleware edge-safe — never import `./db`, `./auth`, or `bcryptjs` from `src/middleware.ts` or `src/server/auth.config.ts`. Re-introducing any of them silently drops middleware onto the Node runtime and resurrects the slow-nav problem.
- Prefer `select` over `include: true` on Prisma queries.
- Cap list queries with `take: N` and move counts/sums to `groupBy`/`aggregate`.
