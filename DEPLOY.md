# Deploying to Railway

This repo holds two parallel things:

1. **`SAB India Tracker.html`** — the single-file React + Babel demo of the
   product (the canonical preview that's been actively iterated on).
2. **A Next.js scaffold** — `src/`, `prisma/`, `package.json` etc. — the
   in-progress production rewrite. **Not yet wired up for Railway** because
   it needs a live Postgres + auth secrets.

The Railway deploy in this branch ships **only #1**: a tiny Python
`http.server` inside a slim container that serves `SAB India Tracker.html`
on `$PORT`. The Next.js scaffold is preserved in the repo but is excluded
from the image via `.dockerignore`.

## Files added for Railway

| File              | Purpose                                                 |
|-------------------|---------------------------------------------------------|
| `Dockerfile`      | Python 3.11-slim, copies HTML + server, runs on `$PORT` |
| `server.py`       | stdlib server, redirects `/` → `/SAB India Tracker.html` |
| `railway.json`    | Tells Railway to use the Dockerfile + healthcheck path  |
| `.dockerignore`   | Excludes Next.js scaffold, node_modules, secrets, tests |

## One-time Railway setup

1. Create a new Railway project.
2. Connect this GitHub repo.
3. Railway auto-detects the `Dockerfile`. No env vars required.
4. First deploy publishes to a `*.up.railway.app` domain. Visiting `/`
   redirects to the HTML demo.

The healthcheck hits `/SAB%20India%20Tracker.html`; if the container
starts but the file isn't reachable, the deploy is marked failed.

## Running locally (parity with Railway)

```bash
docker build -t sab-tracker .
docker run --rm -p 8080:8080 sab-tracker
# open http://localhost:8080
```

Or without Docker:

```bash
python server.py        # listens on $PORT or 8000 by default
```

## Future: deploying the full Next.js app

Out of scope for this branch. To enable, you'll need to:

- Provision Railway Postgres and bind `DATABASE_URL`.
- Set `NEXTAUTH_SECRET`, `AUTH_SECRET`, `NEXTAUTH_URL` (the Railway URL).
- Replace the `Dockerfile` with a Node-based multi-stage build that runs
  `prisma generate && next build && next start -p $PORT`.
- Remove the Next.js entries from `.dockerignore`.
