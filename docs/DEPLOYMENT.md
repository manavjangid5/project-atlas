# Project Atlas — Deployment Guide

All infrastructure runs on free tiers. Four Render services (Postgres,
backend, worker, frontend) plus several external managed services, all
env-var driven.

## Verification status — what's actually been confirmed vs. built-and-locally-tested

Being precise about this rather than implying uniform confidence:

**Confirmed working end-to-end in production (Render)**, via the full
manual regression pass documented in `docs/TESTING_GUIDE.md`, run
against both the local environment and the deployed URL: registration/
login, password auth, Google OAuth, session refresh, multi-tenant
isolation, workflow save/run/retry/parallel-branches/conditional
branching, AI Prompt node (real Gemini output), AI workflow generation, AI
next-node suggestion, AI streaming preview, priority queues, cron
scheduling (including two real production deployment issues found and
fixed along the way — see below), the dynamic permission model across
every mutating/privileged route, all node types (HTTP, Delay, Conditional,
Slack, AI Prompt, Webhook, GitHub, Email, Switch, Loop, Database Query),
notification grouping, dark/light theme toggle, undo/redo, the version
diff view (including cross-page comparison), per-API-key rate limiting,
the real `/metrics` endpoint, Zod validation on all mutating routes,
global search (including organizations and execution logs), form file
uploads genuinely stored in R2, file upload/download/share, CSRF
protection, `/health` reporting both DB and queue as connected, the
`packages/database` fix, and every bug fix from the manual smoke-testing
passes (rule evaluator vacuous-truth and dot-path bugs, conditional-branch
status semantics, audit log pagination, member role-change URL bug, rule
Test-panel stale-save bug, and others — full list in TRADEOFFS.md).

**Two real production-only issues were found and fixed during this
verification pass** — both infrastructure/data-state problems, not code
bugs: (1) the production RabbitMQ queue predated the `x-max-priority`
argument added partway through the build and had to be deleted and
recreated; (2) several schema migrations (including the one adding
`cronSchedule`) had only ever been run against the local database, not
Render's — `npx prisma migrate deploy` had to be run against the
production database directly. Both are now resolved; the general lesson
(schema/queue-argument changes require a manual production sync step, they
don't apply themselves) is documented in TRADEOFFS.md.

**Configured and code-complete, but not separately re-confirmed by an
explicit end-to-end test in this conversation:**
- **GitHub OAuth** — credentials configured in both GitHub and the backend;
  uses the exact same code path as Google OAuth (confirmed working), so it
  is expected to work identically, but a successful "Continue with GitHub"
  login specifically was never independently retested and confirmed.
- **Resend email node** — test runs complete with `status: SUCCESS`,
  confirming the node executes without error, but actual inbox delivery of
  a sent email was not explicitly confirmed by checking an inbox.


match (including the new `prom-client` dependency, which needs no separate
env var — it's a plain npm package), but a fresh deploy-and-click-through
of this full batch was not completed and confirmed within this
conversation. **Run the full `docs/TESTING_GUIDE.md` script against the
deployed URL before treating any of this batch as production-verified.**

## External services (set these up first)

| Service | Used for | Why this one |
|---|---|---|
| **Render Postgres** | Primary database | Free tier; expires 30 days after creation — recreate close to any submission/review date if there's a gap |
| **CloudAMQP** (RabbitMQ, free "Little Lemur" plan) | Message queue for workflow execution | Originally planned Upstash Kafka; Upstash discontinued Kafka in March 2025 (see TRADEOFFS.md) |
| **Cloudflare R2** | File storage (S3-compatible) | Generous free tier; a card is required to activate R2 on the account, though usage within free limits is not charged |
| **Google AI Studio** | Gemini API key for AI nodes, generation, and streaming | Free tier |
| **Google Cloud Console** | Google OAuth credentials | — |
| **GitHub Developer Settings** | GitHub OAuth credentials | — |
| **Resend** | Email node delivery | Free tier; sandbox mode restricts sending to your own signup address unless a domain is verified — see ARCHITECTURE.md |

**Not used, despite being discussed early on:** cron-job.org (external cron
pings) was the original plan for keep-alive, but setup proved unreliable in
practice and was abandoned in favor of the code-based approach below — no
cron-job.org account or job is actually configured for this project. If you
want an external backstop in addition to the code-based keep-alive, it's
still a reasonable option to set up yourself, just not something already
in place.

## Repo layout assumption

This is a pnpm workspace monorepo. All Render "Install dependencies" steps
must resolve pnpm correctly — see the CI/CD section below for the exact
config that avoids Render silently falling back to npm.

**Local vs. production RabbitMQ queue names must differ.** If a local
backend/worker and the deployed backend/worker both point at the same
`RABBITMQ_QUEUE` value on the same CloudAMQP instance, RabbitMQ round-robins
messages between whichever consumers are connected — meaning a local test
run can silently be picked up and executed by the *deployed* worker (against
the *deployed* database, where the run ID doesn't exist), and vice versa.
This was a real bug hit during development. Fix: local `.env` files use
`RABBITMQ_QUEUE=workflow-executions-dev`; Render's env vars keep
`RABBITMQ_QUEUE=workflow-executions`. Same CloudAMQP instance, two isolated
queues, no cross-talk.

## 1. Render Postgres

1. Render dashboard → New → PostgreSQL → name `atlas-db`, Free plan.
2. Copy the **Internal Database URL** (for backend/worker services) and the
   **External Database URL** (for running migrations from your local machine).
3. Run migrations against the fresh DB from your local machine (Prisma
   schema and migrations now live in `packages/database`, not `apps/backend`,
   since Prisma was extracted into a shared workspace package consumed by
   both backend and worker):
   ```
   cd packages/database
   # temporarily set DATABASE_URL in packages/database/.env to the External Database URL
   npx prisma migrate deploy
   # revert .env back to your local Postgres URL afterward
   ```

## 2. Backend — Render Web Service

- **Root Directory:** leave **blank** (repo root) — required now that the
  backend depends on the `packages/database` workspace package; a
  subdirectory Root Directory can't resolve a sibling workspace package.
- **Build Command:**
  `pnpm install --frozen-lockfile && pnpm --filter @atlas/database exec prisma generate && pnpm --filter @atlas/database run build && cd apps/backend && pnpm run build`
- **Start Command:** `node apps/backend/dist/server.js`
- **Instance Type:** Free

**Environment variables:**
```
DATABASE_URL=<Render Internal Database URL>
JWT_SECRET=<strong random string — generate fresh, don't reuse local dev value>
JWT_REFRESH_SECRET=<strong random string>
CSRF_SECRET=<strong random string>
INTERNAL_SERVICE_SECRET=<strong random string — must exactly match the worker's value>
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
RESEND_API_KEY=<for the Email node — free tier only sends to your own signup address unless a domain is verified>
FRONTEND_URL=<frontend's Render URL — set after step 4>
SELF_URL=<backend's own Render URL — used by the mutual keep-alive ping>
WORKER_URL=<worker's Render URL — used by the mutual keep-alive ping>
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

- **Root Directory:** leave **blank** (repo root) — same reason as backend.
- **Build Command:**
  `pnpm install --frozen-lockfile && pnpm --filter @atlas/database exec prisma generate && pnpm --filter @atlas/database run build && cd apps/worker && pnpm run build`
- **Start Command:** `node apps/worker/dist/index.js`
- **Instance Type:** Free

**Environment variables:**
```
DATABASE_URL=<same Render Internal Database URL as backend>
RABBITMQ_URL=<CloudAMQP AMQP URL>
RABBITMQ_QUEUE=workflow-executions
GEMINI_API_KEY=...
RESEND_API_KEY=...
INTERNAL_SERVICE_SECRET=<must exactly match the backend's value>
BACKEND_URL=<backend's Render URL>
SELF_URL=<worker's own Render URL — used by the mutual keep-alive ping>
NODE_ENV=production
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

## 7. Keep-alive

Free Render Web Services spin down after 15 minutes idle (~30-60s cold start
on next request). **Only one mechanism is actually implemented for this
project — a code-based mutual keep-alive**, not an external cron service:

Both `apps/backend` and `apps/worker` run an in-process `setInterval`
(`infrastructure/keepAlive.ts` / `src/keepAlive.ts`, gated on
`NODE_ENV=production`) that pings the *other* service's public URL every 10
minutes (`SELF_URL`, `WORKER_URL` on the backend; `SELF_URL`, `BACKEND_URL`
on the worker — see the env var lists above). This counts as genuine
incoming traffic, resetting each service's own idle clock, with no external
account or dependency needed.

**Honest limitations:**
- If *both* services happen to spin down at the same moment (e.g. right
  after a fresh deploy, before either interval has fired once), there's
  nothing to wake either one back up until a real user request arrives.
- An external cron pinger (cron-job.org or similar) was the original plan
  as a second, independent safety net, but was never actually set up for
  this project — abandoned mid-build in favor of the code-based approach
  above, which was simpler to get working reliably. If stronger redundancy
  is wanted later, adding one is straightforward (hit `<backend
  URL>/api/v1/health` and `<worker URL>/` every 10 minutes) but it is **not
  currently in place**.
- For a live demo or grading session, the safest practical mitigation is
  simply to open the live app yourself a few minutes before the session
  starts, so both services are already warm.

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR to `main`, three parallel
jobs (`backend`, `worker`, `frontend`), each: install from workspace root →
generate **and build** the `packages/database` Prisma client (a dedicated
`tsc` step, not just `prisma generate` — see TRADEOFFS.md for the production
bug this step exists to prevent) → type-check → test → build. The frontend
job runs ESLint with `--max-warnings 0` (not bypassed with
`continue-on-error`) as a real CI gate. Backend job spins up an ephemeral
Postgres service container for running migrations + integration tests
against a real (throwaway) database.

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
