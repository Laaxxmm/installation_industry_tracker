# SAB India Tracker — Next.js + Prisma + NextAuth
# Multi-stage build for Railway. Builds the full app and runs `prisma migrate
# deploy` on every container start before launching `next start`.

# ---------- 1. deps (cache layer) ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy lockfile + schema. Schema is needed because `prisma` postinstall
# generates the client into node_modules/.prisma during `npm ci`.
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Build needs devDependencies (typescript, tailwind, eslint, prisma CLI, tsx).
# We keep them in the runner image too so the entrypoint can run
# `prisma migrate deploy` and (optionally) `tsx prisma/seed.ts`.
RUN npm ci

# ---------- 2. builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env. DATABASE_URL must be a syntactically valid Postgres URL
# for Prisma to load, but the build does not connect to the DB.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@build:5432/build?schema=public"
ENV NEXTAUTH_SECRET="build-time-placeholder-replace-at-runtime"
ENV AUTH_SECRET="build-time-placeholder-replace-at-runtime"

RUN npx prisma generate
RUN npm run build

# ---------- 3. runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway injects $PORT at runtime; default for local docker run.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy the built app + everything needed at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs

# Entrypoint: migrate -> (optional) seed -> start.
# `sed` strip is defensive: if the file ever gets checked out with CRLF on
# someone's Windows machine the script becomes silently unrunnable inside
# alpine. .gitattributes pins LF in the repo but belt-and-braces here.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh \
 && chmod +x docker-entrypoint.sh \
 && head -1 docker-entrypoint.sh

USER nextjs
EXPOSE 8080

# tini reaps zombies and forwards signals (clean shutdown on Railway redeploys).
# Absolute path to the script so $PWD / WORKDIR can't surprise us.
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
