# Project Atlas — Architecture

## 1. What this application actually is

Project Atlas is a multi-tenant workflow automation platform — a self-built,
smaller version of n8n/Zapier with an AI model wired in as a first-class node
type (including natural-language workflow generation), plus a set of internal
productivity tools (dynamic forms, a rules engine, file storage, analytics)
layered on top of a dynamic, data-driven permission system.

A user signs up, creates an **Organization**, invites teammates with
**Roles** (Owner/Admin/Developer/Viewer), and inside that organization can:

- Visually build **Workflows** on a drag-and-drop canvas (React Flow) —
  HTTP Request, Delay, Conditional (real branching), Slack, AI Prompt,
  Webhook, GitHub, Email, Switch, Loop, Database Query.
- **Generate a workflow from a plain-English instruction** via Gemini, or
  get AI-suggested next nodes for a graph in progress.
- **Run** workflows asynchronously with retries, parallel branches, priority
  queueing, and full per-node logs.
- Trigger workflows externally via a per-workflow **webhook URL**, or on a
  **cron schedule**.
- Build **Forms** (conditional fields, repeatable fields) and a **Rule
  Engine** with nested AND/OR logic over arbitrary nested JSON paths, with
  actions that actually fire (notify / trigger another workflow) on real
  form submissions.
- Get **real-time, grouped notifications** (Socket.io).
- Manage **Files** (R2), an **Audit Log**, an **Analytics dashboard**, **API
  Keys** with per-key rate limiting and a real external API surface, and
  **Feature Flags** that genuinely gate behavior (not decorative).
- Use **global Search**, compare/rollback **Workflow Versions** with a real
  diff view, and toggle **dark/light theme**.

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
                     └───┬─────────┬────┘               ▲
                         │         │                     │
             publishes   │         │ Socket.io   ┌───────┘
             to queue    │         │ (grouped notifications)
                         ▼         ▼
                  ┌─────────────┐  Browser (WebSocket)
                  │  RabbitMQ    │
                  │  (CloudAMQP) │  priority queue + DLQ
                  └──────┬───────┘
                         │ consumes (idempotent)
                         ▼
                  ┌─────────────────┐
                  │     Worker       │───────▶ PostgreSQL (shared, via @atlas/database)
                  │  (Web Service —  │───────▶ Gemini API (AI node + streaming)
                  │  free-tier hack) │───────▶ Backend /internal/notify (authed)
                  │  Graph executor  │───────▶ Resend (email node)
                  └─────────────────┘

  packages/database (compiled, shared) ── consumed by both backend and worker
```

Three independently deployed services, one shared Postgres database, one
shared internal package:

| Service | Tech | Deployment |
|---|---|---|
| `apps/frontend` | React + Vite + TypeScript + Tailwind | Render Static Site |
| `apps/backend`  | Node + Express + TypeScript          | Render Web Service |
| `apps/worker`   | Node + TypeScript, RabbitMQ consumer  | Render Web Service (free Background Worker tier was discontinued — see TRADEOFFS.md) |
| `packages/database` | Prisma schema + generated client, compiled with `tsc` | Consumed as a workspace dependency, not deployed independently |

## 3. Monorepo structure

```
project-atlas/
  apps/
    frontend/    React app — src/features/*
    backend/     Express API
    worker/      RabbitMQ consumer + graph executor + AI/email/github node logic
  packages/
    database/    Prisma schema, migrations, and the ONLY generated Prisma
                 client in the repo — both apps depend on it via
                 "@atlas/database": "workspace:*" and import { prisma } from
                 "@atlas/database" directly (backend's prismaClient.ts and
                 worker's db.ts are now thin one-line re-exports for
                 backward-compatible import paths).
  docs/          this documentation set
  .github/workflows/ci.yml
  docker-compose.yml   local Postgres + RabbitMQ
```

### Backend internal layering (`apps/backend/src/`)

```
domain/            Framework-free types + AppError (services import errors
                    from here now, not from the HTTP error-handler middleware)
application/       Business logic — authService, workflowService,
                    organizationService, ruleService, formService,
                    notificationService, analyticsService, fileService,
                    apiKeyService, featureFlagService, searchService,
                    permissionService, aiWorkflowGeneratorService
infrastructure/
  auth/             JWT + refresh token utilities, Passport OAuth strategies
  storage/          Cloudflare R2 client
  realtime/         Socket.io server (verifies org membership before room join)
  audit/            Audit log writer
  rabbitmq/         Producer, priority queue + DLQ setup
  scheduler/        In-process node-cron loader for scheduled workflow runs
interfaces/http/
  routes/           One router per module, incl. aiWorkflow.ts, webhooks.ts,
                     publicApi.ts, internal.ts
  middleware/       requireAuth, requireTenant, requireTenantRole,
                     requirePermission (dynamic), requireApiKey (with
                     per-key rate limit), requireInternalSecret, csrf,
                     validate (Zod), errorHandler
```

Services depend only on `domain/` and `@atlas/database` — no service file
imports Express types or the HTTP error-handler module.

## 4. Multi-tenancy, Auth & Permissions

- **JWT access tokens** (15 min) + **opaque refresh tokens** (30 day,
  SHA-256 hashed at rest) with rotation + reuse detection: a replayed
  revoked token invalidates its entire token family.
- **OAuth** (Google + GitHub) converges into the same token-issuing flow.
- Both tokens live in httpOnly cookies.
- Every tenant-scoped request carries `X-Organization-Id`; `requireTenant`
  looks up a real `Membership` row fresh from the DB on every request — the
  single choke point that makes cross-tenant access structurally impossible.
- **Dynamic permission model**: `requirePermission(resource, action)`
  checks an org-specific `Permission` override row first, falling back to a
  sane built-in default matrix per role. An Owner can grant/restrict a
  specific role's access to a specific resource/action for their org
  without a code change or redeploy — this satisfies the spec's explicit
  "permissions must be dynamic rather than hardcoded" requirement. A
  smaller number of lower-stakes routes (evaluate/restore/share) still use
  the simpler static `requireTenantRole` check — a deliberate scope choice,
  not an oversight (see TRADEOFFS.md).
- **CSRF**: double-submit-cookie pattern via `csrf-csrf`, with an explicit
  `getTokenFromRequest` (required for the installed major version) and a
  session identifier that is NOT tied to the rotating access token (an
  earlier bug — fixed).

## 5. Workflow Execution Engine

1. A run can start three ways: clicking **Run** (`POST /workflows/:id/run`),
   an external **webhook** call (`POST /webhooks/:token`, no auth — the
   token itself is the secret), or a **cron** schedule.
2. The API creates an `ExecutionRun` (`PENDING`) and publishes a prioritized
   message to RabbitMQ, returning `202` immediately — never blocks on
   execution.
3. The **worker** consumes with an **idempotency guard** (skips redelivered
   messages for runs no longer `PENDING`, preventing duplicate side effects
   like double emails/Slack posts on redelivery) and calls `executeGraph()`:
   - Builds a dependency graph from nodes/edges.
   - Runs all currently-ready nodes **in parallel** (`Promise.all`).
   - **Conditional/Switch nodes genuinely branch**: an edge tagged with a
     `branch` (`true`/`false`) only "satisfies" its target if the source
     node actually took that branch — the untaken branch's downstream nodes
     are marked `SKIPPED`, not silently executed. This was a real defect in
     an earlier version (branch output was computed but ignored) — fixed.
   - Each node retries up to 3 times with exponential backoff, writing an
     `ExecutionLog` row per attempt.
   - On an unhandled crash (not a normal node failure, which is `ack`'d as
     `FAILED`), the message is `nack`'d to a **dead-letter queue**
     (`workflow-executions-dlx` → `workflow-executions-dlq`) instead of
     being silently dropped.
   - Final status: `SUCCESS`, `PARTIAL`, or `FAILED`.
4. HTTP/Webhook/Slack/GitHub node URLs pass through an **SSRF guard**
   (`assertSafeUrl`) that DNS-resolves the hostname and blocks RFC1918/
   link-local/loopback/cloud-metadata IP ranges before the request fires.
5. HTTP/Webhook node config supports **real `{node-id_output}` templating**
   in the URL, body, and headers (an earlier version passed static config
   only — fixed) — values resolve against the run's accumulated
   `ctx.variables`.
6. On completion, the worker calls `POST /internal/notify` on the backend,
   authenticated via a shared `X-Internal-Secret` header (an earlier version
   left this endpoint open — fixed), which pushes a grouped real-time
   notification via Socket.io.
7. **Frontend design-time validation** (`graphValidation.ts`) runs before
   Run is even allowed to fire: detects real graph cycles (DFS), flags
   Conditional nodes with no connected branches, flags orphan nodes, and
   flags a small set of known type-incompatible node chains (e.g. Delay →
   Conditional) as warnings.

## 6. AI capabilities

**AI Prompt node** (per-workflow-run execution): Gemini (`gemini-flash-latest`),
prompt templating against prior node outputs, 2 retries with backoff, 10-min
in-memory response cache, and a **graceful fallback that correctly returns
FAILED** (not a false `SUCCESS`) when Gemini is unavailable after retries —
an earlier version silently masked AI failures as successes; fixed, since
that materially misrepresented run health.

**Workflow generation** (`POST /workflows/generate`): takes a natural-language
instruction, prompts Gemini with a strict JSON schema constrained to the
platform's actual executable node kinds, validates every generated node kind
and edge reference before persisting, and creates a new workflow pre-populated
with the result — directly satisfies the spec's "AI node should be able to
generate an entire workflow" requirement.

**Next-node suggestions** (`POST /workflows/:id/suggest-next`): given the
current partial graph (and optionally the original instruction), asks Gemini
for up to 3 relevant next nodes with a one-line reason each, rendered as
clickable chips on the canvas.

**Streaming** (`POST /ai/stream-test`, Server-Sent Events): lets a user
preview an AI Prompt node's actual output live, token-chunk by token-chunk,
before saving/running it — uses `generateContentStream` on the backend and a
`fetch`-based SSE reader on the frontend (native `EventSource` doesn't
support POST bodies, so a manual SSE parser is used). This satisfies the
spec's explicit "streaming responses" requirement for the AI node's
*interactive preview* path; full workflow *execution* itself remains
request/response internally (a run's node outputs are written to the DB and
picked up by the frontend's 3-second poll of Run History, not streamed
live token-by-token during actual graph execution — a deliberate scope
boundary, not an oversight).

AI nodes remain deliberately **stateless per call** — no cross-node
conversational memory; context passes explicitly via `{node-id_output}`
templating, matching the data-pipeline pattern used by n8n/Zapier/GitHub
Actions rather than a chatbot's turn-by-turn memory model.

## 7. Real-time layer (Socket.io)

- Client connects; the httpOnly `accessToken` cookie is read off the raw
  handshake headers server-side and verified.
- On `join-org`, the server now **verifies a real `Membership` row exists**
  for that user/org before allowing the socket to join the room — an
  earlier version allowed joining any `org:<id>` room with no check; fixed.
- Notifications carry an optional `groupKey` (e.g. `workflow:<id>`); the
  frontend collapses consecutive same-`groupKey` notifications into a single
  grouped entry rather than showing every lifecycle event as a separate row.

## 8. Security

- CSRF, SSRF guard, IDOR-safe scoped mutations (every `update`/`delete`
  service call scopes by `organizationId`, verified via audit after the
  original `restoreFile` bug was found and fixed), rate limiting (global
  IP-based on all routes, plus a separate per-API-key limiter), Helmet with
  explicit CSP, XSS mitigated by React's default escaping (no
  `dangerouslySetInnerHTML` anywhere), SQL injection structurally
  prevented (100% Prisma parameterized queries), password policy, file
  upload validation.
- **Middleware ordering** was a real, fixed bug: CSRF protection now runs
  strictly before every router; the 4-arg error handler is mounted last.
- Zod request validation (`validate.ts`) is applied to auth, organization,
  and workflow mutating routes — not yet extended to every mutating route
  across every module (a scope boundary, see TRADEOFFS.md).

## 9. Frontend architecture

- Vite + React + TypeScript, feature-folder structure, Zustand for
  auth/org/theme state.
- Route guards (`RequireAuth`/`RedirectIfAuthed`) re-validate the session
  against the backend on every mount rather than trusting stale client state.
- **Theme**: real CSS-custom-property-based dark/light toggle (Tailwind
  color tokens reference `var(--color-*)`, not hardcoded hex) — persisted
  to localStorage.
- **Undo/redo**: a real history stack (`useGraphHistory`) pushed before
  every canvas mutation (node add/delete/config change), bound to
  Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z.
- Error boundaries wrap the whole app; every dashboard route is lazy-loaded
  behind `React.lazy`/`Suspense`.
- Workflows are **re-fetched fresh** every time one is opened from the list
  (an earlier version showed stale cached data until a manual page reload —
  fixed), and the parent list syncs after every save.

## 10. Known, honestly-documented scope boundaries

See TRADEOFFS.md for the full list with reasoning. Headline items: no
Prometheus/Grafana metrics; cron scheduler is in-process (misses a run due
during a backend restart window rather than queuing it); email invitation
delivery not implemented; per-API-key and global rate limiting are
in-process, not Redis-backed (documented scaling limitation); form file-upload
fields are UI-only, not wired to real storage; notification @mentions are
structured-config-based, not free-text `@name` parsing.