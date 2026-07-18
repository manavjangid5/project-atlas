# Project Atlas — Architecture

## 1. What this application actually is

Project Atlas is a multi-tenant workflow automation platform — think a self-built,
smaller version of n8n/Zapier with an AI model wired in as a first-class node type,
plus a set of internal productivity tools (dynamic forms, a rules engine, file
storage, analytics) layered on top of the same organization/permission system.

A user signs up, creates an **Organization**, invites teammates with specific
**Roles** (Owner/Admin/Developer/Viewer), and inside that organization can:

- Visually build **Workflows** on a drag-and-drop canvas (React Flow), wiring
  together nodes like HTTP Request, Delay, Conditional, Slack, AI Prompt, Webhook.
- **Run** those workflows — execution happens asynchronously on a separate worker
  process, with retries, parallel branches, and full per-node logs.
- Build **Forms** with conditional fields, and a **Rule Engine** with nested
  AND/OR logic that can be tested against sample data.
- Get **real-time notifications** (Socket.io) when workflows start/finish.
- Manage **Files** (upload/download/share, stored in Cloudflare R2).
- View an **Audit Log** of every meaningful action, and an **Analytics
  dashboard** (success rates, node usage, daily execution volume).
- Manage **API Keys** for programmatic access, and **Feature Flags** with
  percentage-based rollout.
- Use **global Search** across workflows, forms, rules, files, and members.

## 2. High-level system diagram

```
                     ┌─────────────────┐
                     │   Frontend       │   React + Vite + TS + Tailwind
                     │  (Static Site)   │   Zustand, React Flow, Recharts
                     └────────┬─────────┘
                              │ HTTPS (cookies, CSRF token, X-Organization-Id)
                              ▼
                     ┌─────────────────┐        ┌──────────────┐
                     │    Backend       │───────▶│  PostgreSQL   │
                     │  (Web Service)   │        │  (Render)     │
                     │  Express + TS    │        └──────────────┘
                     │  Prisma ORM      │
                     └───┬─────────┬────┘
                         │         │
             publishes   │         │ Socket.io (live notifications)
             to queue    │         │
                         ▼         ▼
                  ┌─────────────┐  Browser (WebSocket)
                  │  RabbitMQ    │
                  │  (CloudAMQP) │
                  └──────┬───────┘
                         │ consumes
                         ▼
                  ┌─────────────────┐        ┌──────────────┐
                  │     Worker       │───────▶│  PostgreSQL   │ (shared DB)
                  │  (Web Service —  │        └──────────────┘
                  │  free-tier hack) │───────▶ Gemini API (AI node)
                  │  Graph executor  │───────▶ Calls backend /internal/notify
                  └─────────────────┘         on run completion
```

Three independently deployed services, one shared Postgres database:

| Service | Tech | Deployment |
|---|---|---|
| `apps/frontend` | React + Vite + TypeScript + Tailwind | Render Static Site |
| `apps/backend`  | Node + Express + TypeScript + Prisma  | Render Web Service |
| `apps/worker`   | Node + TypeScript, RabbitMQ consumer  | Render Web Service (see TRADEOFFS.md — free Background Worker tier was discontinued mid-project) |

## 3. Monorepo structure

```
project-atlas/
  apps/
    frontend/    React app — all UI, feature modules under src/features/*
    backend/     Express API — hexagonal-ish layering (see below)
    worker/      RabbitMQ consumer + workflow graph executor + AI node
  packages/
    shared/      (reserved — not yet extracted, see TRADEOFFS.md)
  docs/          this documentation set
  .github/workflows/ci.yml   CI: type-check, test, build across all 3 packages
  docker-compose.yml         local Postgres + Redis for dev
```

### Backend internal layering (`apps/backend/src/`)

```
domain/            Framework-free types (e.g. form/rule condition trees)
application/       Business logic / use-cases (authService, workflowService,
                    organizationService, ruleService, formService,
                    notificationService, analyticsService, fileService,
                    apiKeyService, featureFlagService, searchService)
infrastructure/     Concrete implementations
  auth/             JWT + refresh token utilities, Passport OAuth strategies
  database/         Prisma client singleton
  storage/          Cloudflare R2 (S3-compatible) client
  realtime/         Socket.io server
  audit/            Audit log writer
  kafka/             (historical name — now holds the RabbitMQ client, see TRADEOFFS)
interfaces/http/
  routes/           Express routers, one per module
  middleware/       requireAuth, requireTenant, requireTenantRole,
                     errorHandler, apiKeyAuth, csrf
```

This is a lightweight hexagonal/ports-and-adapters style: `application/` services
never import Express types directly; routes are thin and just translate
HTTP ↔ service calls.

## 4. Multi-tenancy & Auth

- **JWT access tokens** (15 min TTL) + **opaque refresh tokens** (30 day TTL,
  stored only as SHA-256 hashes in the DB) with full **rotation + reuse
  detection**: every refresh call revokes the old token and issues a new one
  in the same "family"; if a revoked token is ever replayed, the entire family
  is invalidated (all sessions logged out) as a compromise signal.
- **OAuth** via Passport (Google + GitHub), converging into the same
  token-issuing flow as password login.
- Both tokens live in **httpOnly cookies** — never touched by frontend JS.
- Every tenant-scoped request must carry an `X-Organization-Id` header. The
  `requireTenant` middleware verifies the authenticated user actually has a
  `Membership` row for that organization (looked up fresh from the DB, not
  trusted from the JWT) before attaching `req.tenant = { organizationId, role }`.
  This is the single choke point that prevents cross-tenant data access.
- Role-based route guards (`requireTenantRole("OWNER", "ADMIN")`) sit on top
  of that for privileged actions (invites, role changes, org rename).

## 5. Workflow Execution Engine

This is the core piece. Design goals: async, retryable, observable, supports
parallel independent branches.

1. `POST /workflows/:id/run` creates an `ExecutionRun` row (`status: PENDING`)
   and publishes a message (`runId`, `workflowId`, `graph`) to RabbitMQ.
   Returns `202 Accepted` immediately — never blocks the API on execution.
2. The **worker** consumes the message and calls `executeGraph()`:
   - Builds an adjacency list from the graph's nodes/edges.
   - Repeatedly finds nodes whose dependencies have all completed (or failed),
     and runs all currently-ready nodes **in parallel** via `Promise.all` —
     this is what satisfies "parallel execution of independent branches"
     without needing a full DAG-scheduling library.
   - Each node runs through `runNodeWithRetry`: up to 3 attempts with
     exponential backoff, writing an `ExecutionLog` row per attempt.
   - If a node fails all retries, its downstream dependents are marked
     `SKIPPED` rather than silently run with missing data.
   - Final run status: `SUCCESS` (all nodes succeeded), `PARTIAL` (some
     succeeded, some failed), or `FAILED` (nothing succeeded).
3. Node "kinds" (`http_request`, `delay`, `conditional`, `slack`, `webhook`,
   `ai_prompt`) each have a small executor function returning
   `{ status, output, error }`. Outputs are stored in a shared per-run
   `variables` object keyed by node ID, so later nodes can reference earlier
   outputs via `{node-id_output}` template syntax in their config.
4. On completion, the worker calls back to the backend
   (`POST /internal/notify`) so a real-time notification can be pushed to the
   organization via Socket.io — the worker has no direct Socket.io server of
   its own, keeping that concern centralized in the backend.

## 6. AI Node

Uses Google Gemini (`gemini-flash-latest`), with:
- **Prompt templating**: `{variable}` placeholders resolved against the run's
  accumulated node outputs before the call.
- **Retries** (2 attempts) with backoff.
- **Graceful fallback**: if Gemini is unavailable after retries, the node
  still returns `SUCCESS` with a fallback text payload (`fallback: true`)
  rather than failing the whole run — a workflow shouldn't hard-fail just
  because one AI call degraded.
- **In-memory response caching** (10 min TTL, keyed by SHA-256 of the prompt)
  to avoid redundant calls for repeated/similar prompts.
- Deliberately **stateless per call** — no cross-node conversational memory.
  Context passing between AI nodes is explicit via the variable-templating
  system, matching the data-pipeline pattern used by n8n/Zapier/GitHub Actions,
  rather than a chatbot's turn-by-turn memory model. True multi-turn memory is
  scoped as a separate future "AI chat assistant" feature (see
  SCALABILITY_AND_FUTURE_WORK.md).

## 7. Real-time layer (Socket.io)

- Client connects and its httpOnly `accessToken` cookie is read directly off
  the raw handshake headers server-side (never exposed to client JS) and
  verified; on success the socket joins `org:<id>` and `user:<id>` rooms.
- `notificationService.createNotification()` writes a `Notification` row
  **and** emits to the relevant room in the same call — DB and real-time
  delivery always stay in sync.

## 8. Security

- **Auth**: httpOnly, `sameSite=lax` cookies for both access and refresh
  tokens; refresh rotation with reuse detection (see §4).
- **CSRF**: double-submit-cookie pattern (`csrf-csrf` package) on all
  state-changing requests except login/register/refresh/OAuth entry points.
- **XSS**: React's default text escaping covers all rendered user input;
  no `dangerouslySetInnerHTML` anywhere in the codebase.
- **SQL injection**: structurally not possible without deliberately writing
  raw SQL — every query goes through Prisma's parameterized query builder;
  the one `$queryRaw` usage (health check) has no interpolated input.
- **Headers**: Helmet with an explicit CSP.
- **Rate limiting**: stricter limiter on auth routes, a more generous global
  limiter on all other `/api/v1` routes.
- **Password policy**: min 8 chars, 1 uppercase, 1 number (enforced server-side
  at registration).
- **File uploads**: MIME-type allowlist, 20MB size cap, validated server-side
  before upload to R2.

## 9. Frontend architecture

- **Vite + React + TypeScript**, feature-folder structure
  (`src/features/<module>/`), Zustand for global auth/org state, React Query–free
  (uses direct axios calls per feature's `*Api.ts` file with local component state).
- **Route guards**: `RequireAuth` re-validates the session against
  `GET /auth/me` on every protected-route mount (not just trusting in-memory
  state), redirecting to `/login` if invalid. `RedirectIfAuthed` does the
  inverse on `/login` and `/register`, so an authenticated user can never
  navigate backward into the auth screens.
- **Design language**: dark theme, warm-orange accent, pill-shaped buttons —
  modeled after Outlier.ai's visual identity, per explicit design direction.

## 10. Known deliberate scope boundaries

See TRADEOFFS.md for the full list with reasoning. Summary: Elasticsearch was
skipped in favor of Postgres `ILIKE` search (spec explicitly allows either);
workflow version **storage** exists from day one but a diff/rollback **UI**
was not built; the internal worker→backend notify endpoint has no auth
(same-network assumption, documented); Prisma client is shared across
backend/worker via a direct package dependency rather than an extracted
`packages/database` workspace package.
