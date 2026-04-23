# Deploying SAB India Tracker to Railway

This deploys the **full Next.js application** — UI, server actions, Prisma
ORM, NextAuth credentials login, the PDF generators, the mobile API, and
all background work. It runs database migrations on every container start.

> The earlier static-only deployment (a Python server fronting
> `SAB India Tracker.html`) is preserved in the repo at `server.py` and
> the HTML file, but it is **not** what Railway builds. The current
> `Dockerfile` is the Node + Next.js production image.

## What ships

| File                    | Purpose                                                                 |
|-------------------------|-------------------------------------------------------------------------|
| `Dockerfile`            | Multi-stage Node 20 build: deps → build → runner. Includes Prisma client |
| `docker-entrypoint.sh`  | Runs `prisma migrate deploy`, optionally seeds, then `next start`        |
| `railway.json`          | Tells Railway to use the Dockerfile + healthcheck `/login` (public)      |
| `.dockerignore`         | Excludes `node_modules`, mobile/Android, tests, docs, secrets, demo HTML |

## One-time Railway setup

### 1. Create the project + database

1. **New Project** → **Deploy from GitHub** → pick
   `Laaxxmm/installation_industry_tracker`. Railway auto-detects the
   `Dockerfile` and starts building. The first build will fail until
   step 2 — that's expected.
2. In the same project, click **+ New** → **Database** → **PostgreSQL**.
   Railway provisions a Postgres instance and exposes a `DATABASE_URL`
   reference variable.

### 2. Bind environment variables

On the **Next.js service** → **Variables**, add:

| Variable           | Value                                                          | Notes                                          |
|--------------------|----------------------------------------------------------------|-----------------------------------------------|
| `DATABASE_URL`     | `${{ Postgres.DATABASE_URL }}`                                 | Reference, not the literal string              |
| `NEXTAUTH_SECRET`  | output of `openssl rand -base64 32`                            | Required                                       |
| `AUTH_SECRET`      | same value as `NEXTAUTH_SECRET`                                | NextAuth v5 reads either                       |
| `NEXTAUTH_URL`     | `https://<your-service>.up.railway.app`                        | Set after the first deploy gives you a domain  |
| `APP_TZ`           | `Asia/Kolkata`                                                 | Renders timestamps in IST                      |
| `SAB_COMPANY_NAME` | `SAB India`                                                    | Branding shown on quotes / invoices / POs      |
| `SAB_STATE_CODE`   | `29`                                                           | Karnataka GST state code                       |
| `SAB_GSTIN`        | your real GSTIN                                                | Drives CGST/SGST vs IGST split                 |
| `SAB_ADDRESS`      | full registered address                                        | Prints on tax invoices                         |
| `SAB_BANK_DETAILS` | `Bank: …  · A/c: …  · IFSC: …`                                  | Prints on tax invoices                         |
| `SAB_LOGO_URL`     | hosted PNG/JPG URL (optional)                                  | Shown on PDFs                                  |
| `SEED_DB`          | `true` (first deploy ONLY) then **delete or set to `false`**   | Populates demo users + sample projects         |

### 3. Trigger a fresh deploy

Once the variables are saved, the service redeploys automatically. The
container will:

1. Print start banner (`==> SAB India Tracker starting…`)
2. Run `npx prisma migrate deploy` against the bound Postgres
3. If `SEED_DB=true`, run `npx tsx prisma/seed.ts`
4. Start `next start` on `0.0.0.0:$PORT`

Watch the deploy logs in Railway — successful boot ends with a Next.js
"Ready in N ms" line.

### 4. After first successful boot

- **Remove `SEED_DB`** from variables (or set to `false`). Seed uses
  `upsert` so it's idempotent, but you don't want an extra ~1s on every
  redeploy.
- **Sign in** at `/login` with one of the seeded accounts:
  - `admin@sab.local` / `password123` (ADMIN)
  - `manager@sab.local` / `password123` (MANAGER)
  - `super@sab.local` / `password123` (SUPERVISOR)
  - `hourly@sab.local` / `password123` (EMPLOYEE, hourly)
  - `salaried@sab.local` / `password123` (EMPLOYEE, salaried)
- **Change the seeded passwords** before sharing the URL outside your team.

## Healthcheck

Railway hits `/login` (public, returns 200). If the container starts but
that route doesn't respond within the timeout (120s), the deploy is
marked failed and rolled back. The 120s window covers cold start +
Prisma migration + Next.js server warmup.

## Running locally with Docker

The image is portable — the same `Dockerfile` runs anywhere:

```bash
# Build
docker build -t sab-tracker .

# Run against a local Postgres (started separately, e.g. via docker-compose)
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/sab" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXTAUTH_URL="http://localhost:8080" \
  -e SEED_DB=true \
  sab-tracker

# Open http://localhost:8080/login
```

## Running locally without Docker

The original Next.js dev workflow is unchanged:

```bash
cp .env.example .env       # then fill in DATABASE_URL etc.
npm install
npx prisma migrate dev      # creates the schema on your local Postgres
npm run db:seed             # populates demo data
npm run dev                 # http://localhost:3000
```

## File uploads

`public/uploads/` is excluded from the Docker image (per-tenant runtime
data). On Railway, the container filesystem is **ephemeral** — uploads
written there are lost on every redeploy. Before relying on uploads in
production, mount a persistent volume (Railway → service → Volumes →
mount at `/app/public/uploads`) or wire the upload routes to S3 / R2.

## Static-HTML demo (legacy)

If you want to keep the `SAB India Tracker.html` preview alongside the
real app, drop the file into `public/` — Next.js will serve it
verbatim at `/SAB%20India%20Tracker.html`. It's currently excluded from
the Docker image to keep the deploy focused.
