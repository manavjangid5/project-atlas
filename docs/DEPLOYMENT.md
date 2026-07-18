# Project Atlas — Deployment Guide

All infrastructure runs on free tiers. Four Render services + three external
managed services, all env-var driven.

## External services (set these up first)

| Service | Used for | Why this one |
|---|---|---|
| **Render Postgres** | Primary database | Free tier; expires 30 days after creation — recreate close to any submission/review date if there's a gap |
| **CloudAMQP** (RabbitMQ, free "Little Lemur" plan) | Message queue for workflow execution | Originally planned Upstash Kafka; Upstash discontinued Kafka in March 2025 |
| **Cloudflare R2** | File storage (S3-compatible) | Generous free tier, card required, charges implemented after free limit exhaustion|
| **Google AI Studio** | Gemini API key for AI nodes | Free tier |
| **Google Cloud Console** | Google OAuth credentials | — |
| **GitHub Developer Settings** | GitHub OAuth credentials | — |
| **cron-job.org** (optional) | Keep-alive pings | Free Render web services spin down after 15 min idle |

## Repo layout assumption

This is a pnpm workspace monorepo. All Render "Install dependencies" steps
must resolve pnpm correctly — see the CI/CD section below for the exact
config that avoids Render silently falling back to npm.

## 1. Render Postgres

1. Render dashboard → New → PostgreSQL → name `atlas-db`, Free plan.
2. Copy the **Internal Database URL** (for backend/worker services) and the
   **External Database URL** (for running migrations from your local machine).
3. Run migrations against the fresh DB from your local machine:
   ```
   cd apps/backend
   # temporarily set DATABASE_URL in .env to the External Database URL
   npx prisma migrate deploy
   # revert .env back to your local Postgres URL afterward
   ```

## 2. Backend — Render Web Service

- **Root Directory:** `apps/backend`
- **Build Command:**
  `pnpm install --frozen-lockfile && npx prisma generate && pnpm run build`
- **Start Command:** `node dist/server.js`
- **Instance Type:** Free

**Environment variables:**
```
DATABASE_URL=<Render Internal Database URL>
JWT_SECRET=<strong random string — generate fresh, don't reuse local dev value>
JWT_REFRESH_SECRET=<strong random string>
CSRF_SECRET=<strong random string>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GEMINI_API_KEY=...
RABBITMQ_URL=<CloudAMQP AMQP URL>
RABBITMQ_QUEUE=workflow-executions
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=atlas-files
FRONTEND_URL=<frontend's Render URL — set after step 4>
NODE_ENV=production
```

Generate strong secrets locally with:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Worker — Render Web Service (not "Background Worker")

**Important:** Render discontinued the free tier for its dedicated Background
Worker service type mid-project (now $7/mo minimum). Workaround: deploy the
worker **as a Web Service** with a minimal HTTP health-check server
(`src/healthServer.ts`) running alongside the real RabbitMQ consumer logic in
the same process, purely to satisfy Render's free-tier port-binding
requirement. See TRADEOFFS.md for full reasoning and the spin-down implication.

- **Root Directory:** `apps/worker`
- **Build Command:**
  `pnpm install --frozen-lockfile && npx prisma generate --schema=../backend/prisma/schema.prisma && pnpm run build`
- **Start Command:** `node dist/index.js`
- **Instance Type:** Free

**Environment variables:**
```
DATABASE_URL=<same Render Internal Database URL as backend>
RABBITMQ_URL=<CloudAMQP AMQP URL>
RABBITMQ_QUEUE=workflow-executions
GEMINI_API_KEY=...
BACKEND_URL=<backend's Render URL>
```

## 4. Frontend — Render Static Site

- **Root Directory:** leave **blank** (repo root) — required so Render's
  package-manager auto-detection finds the workspace's `pnpm-lock.yaml`;
  setting Root Directory to `apps/frontend` causes Render to fall back to
  npm and fail on postinstall scripts.
- **Build Command:** `pnpm install --frozen-lockfile && cd apps/frontend && pnpm run build`
- **Publish Directory:** `apps/frontend/dist`

**Environment variables:**
```
VITE_API_URL=<backend's Render URL>/api/v1
```
Vite inlines env vars at **build time** — changing this value requires a
redeploy, not just a save, to take effect.

**SPA routing fix (required):** add `apps/frontend/public/_redirects`
containing:
```
/*    /index.html   200
```
Without this, refreshing any client-side route (e.g. `/dashboard/workflows`)
returns a 404, since Render's static file server looks for a literal file at
that path. This file is copied verbatim into `dist/` by Vite's build.

## 5. Close the loop

Once the frontend is live, go back to the **backend** service's environment
variables and set `FRONTEND_URL` to the frontend's actual Render URL, then
redeploy the backend — this is what makes CORS and the post-OAuth-login
redirect target the real production frontend instead of localhost.

## 6. Update OAuth redirect URIs for production

- **Google Cloud Console** → OAuth client → Authorized redirect URIs → add
  `<backend URL>/api/v1/auth/google/callback` (keep the localhost one too).
- **GitHub OAuth App** → only supports **one** callback URL per app. Either
  point it at production (breaks local GitHub login) or create a second
  GitHub OAuth App dedicated to local dev. Documented tradeoff — see
  TRADEOFFS.md.

## 7. Keep-alive (optional, recommended for demo/grading windows)

Free Render Web Services spin down after 15 minutes idle (~30-60s cold start
on next request). Set up free cron pings via cron-job.org, every 10 minutes,
against:
```
<backend URL>/api/v1/health
<worker URL>/          (health server root)
```

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR to `main`, three parallel
jobs (`backend`, `worker`, `frontend`), each: install from workspace root →
generate Prisma client → type-check → test → build. Backend job spins up an
ephemeral Postgres service container for running migrations + tests against
a real (throwaway) database. See TRADEOFFS.md for the specific version-pinning
issues this pipeline surfaced and fixed (pnpm/action-setup version conflict,
Express 5 param typing, worker's Prisma client resolution).

## Known operational caveats

- Render free Postgres **expires 30 days** after creation with a further
  grace period before hard deletion — recreate and re-migrate close to any
  actual review/demo date rather than on day one of the build.
- Both backend and worker (as free Web Services) **cold-start** after 15 min
  idle — mitigated by the cron keep-alive pings above, but still worth
  mentioning in a demo ("first load may take ~40s").
- The worker's health server means it technically "responds to HTTP" but its
  real job (queue consumption) has no HTTP surface — if RabbitMQ delivers a
  message while the worker instance is spun down, it will be picked up as
  soon as the next keep-alive ping wakes the instance, not instantly.
