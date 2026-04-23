#!/bin/sh
# SAB India Tracker — container entrypoint.
# Verbose by design: every step prints a banner so the failure point is
# obvious in Railway deploy logs. Set -e so any failure kills the
# container instead of letting it limp into a broken healthcheck.

set -e

PORT="${PORT:-8080}"

echo "============================================================"
echo "  SAB India Tracker — boot"
echo "============================================================"
echo "  NODE_ENV  = ${NODE_ENV:-<unset>}"
echo "  PORT      = ${PORT}"
echo "  HOSTNAME  = ${HOSTNAME:-<unset>}"
echo "  PWD       = $(pwd)"
echo "  whoami    = $(whoami)"
echo "  node      = $(node --version 2>&1 || echo MISSING)"
echo "  DATABASE_URL is $([ -n "${DATABASE_URL}" ] && echo SET || echo UNSET)"
echo "  NEXTAUTH_SECRET is $([ -n "${NEXTAUTH_SECRET}" ] && echo SET || echo UNSET)"
echo "  AUTH_SECRET is $([ -n "${AUTH_SECRET}" ] && echo SET || echo UNSET)"
echo "  NEXTAUTH_URL = ${NEXTAUTH_URL:-<unset>}"
echo "  SEED_DB   = ${SEED_DB:-<unset>}"
echo "============================================================"

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set."
  echo "       In Railway → service → Variables, set:"
  echo "         DATABASE_URL = \${{ Postgres.DATABASE_URL }}"
  echo "       (with the curly-brace reference, not the literal URL)"
  exit 1
fi

echo "==> [1/3] prisma migrate deploy"
if ! node node_modules/prisma/build/index.js migrate deploy; then
  echo "FATAL: prisma migrate deploy failed (see Prisma error above)."
  echo "       Common causes:"
  echo "       - DATABASE_URL points at a host the container can't reach"
  echo "       - The database user lacks CREATE/ALTER permissions"
  echo "       - A previous failed migration left the _prisma_migrations table dirty"
  exit 1
fi

if [ "$SEED_DB" = "true" ]; then
  echo "==> [2/3] SEED_DB=true → running prisma/seed.ts"
  node node_modules/tsx/dist/cli.mjs prisma/seed.ts || {
    echo "    Seed exited non-zero — usually means DB is already populated."
    echo "    Continuing to start the server."
  }
else
  echo "==> [2/3] skipping seed (SEED_DB != true)"
fi

echo "==> [3/3] next start on 0.0.0.0:${PORT}"
# Bypass npm — call the next binary directly so there is no chance of
# npm script arg parsing eating the --port flag.
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "$PORT"
