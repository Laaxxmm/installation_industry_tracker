#!/bin/sh
# SAB India Tracker — container entrypoint.
# Runs schema migrations on every boot, optionally seeds demo data, then starts
# the Next.js server. Designed to be safe to run on every Railway deploy.

set -e

echo "==> SAB India Tracker starting…"
echo "    NODE_ENV=$NODE_ENV"
echo "    PORT=$PORT"

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set. Bind a Railway Postgres plugin or"
  echo "       set DATABASE_URL manually in the service variables."
  exit 1
fi

echo "==> Applying database migrations (prisma migrate deploy)…"
npx --no-install prisma migrate deploy

# Optional one-shot seeding. Set SEED_DB=true on first deploy to populate
# the demo users + sample projects. Seed uses upsert, so re-running is
# idempotent — but we still gate it to avoid surprises on later deploys.
if [ "$SEED_DB" = "true" ]; then
  echo "==> SEED_DB=true — running prisma/seed.ts…"
  npx --no-install tsx prisma/seed.ts || {
    echo "    Seed exited non-zero. Continuing — most likely the DB is"
    echo "    already populated. Check logs above if this is unexpected."
  }
fi

echo "==> Starting Next.js (next start) on 0.0.0.0:$PORT"
exec npm start -- --hostname 0.0.0.0 --port "$PORT"
