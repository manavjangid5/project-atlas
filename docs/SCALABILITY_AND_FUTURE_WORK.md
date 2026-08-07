# Project Atlas — Scalability & Future Work

## Current design choices that already support scale

- **Async execution by design**: `POST /workflows/:id/run` never blocks on
  actual execution — it enqueues and returns `202` immediately. This means
  API response times stay flat regardless of how long a workflow takes to run,
  and multiple worker instances could consume the same queue in parallel
  with zero code changes (RabbitMQ handles competing-consumer distribution
  natively).
- **Parallel branch execution** in the graph executor means a workflow with
  independent branches doesn't pay for their combined latency serially.
- **Stateless backend/worker processes** — no in-process session state beyond
  the in-memory AI cache and rate limiter (see TRADEOFFS.md for the caveats
  on those two specifically) — meaning both services can, in principle, be
  horizontally scaled by just adding instances behind a load balancer.
- **Every tenant-scoped table is indexed on `organizationId`**, and the
  compound unique constraint on `Membership(userId, organizationId)` keeps
  the tenant-check query on every request cheap (single indexed lookup).
- **Soft deletes** on `Workflow`/`FileAsset` avoid destructive data loss
  under load or bugs, at the cost of slightly larger tables over time
  (mitigated by the `deletedAt IS NULL` filter already indexed alongside
  `organizationId` in practice).

## Path to the spec's "100,000+ executions" target

Current architecture already separates the read path (API) from the write/
compute path (worker), which is the right shape for this target. To actually
sustain 100k+ executions in production, the concrete next steps would be:

1. **Multiple worker replicas** consuming the same RabbitMQ queue — no code
   change needed, purely an infra/scaling decision (RabbitMQ's competing
   consumers pattern handles this natively).
2. **Move the AI response cache and rate limiter to Redis** — required the
   moment there's more than one backend/worker instance, since in-memory
   state doesn't share across processes. Note: Redis was deliberately
   **removed** from `docker-compose.yml` earlier in the build since it sat
   unused (see TRADEOFFS.md) — reintroducing it would be a conscious step
   taken specifically to back these two pieces of state, not a leftover
   piece of infra to just "turn on."
3. **Connection pooling** — currently relying on Prisma's default pool per
   process; at higher concurrency this should move to PgBouncer or a managed
   pooler (Render Postgres / Neon both offer this) to avoid exhausting
   Postgres's max connections across many worker instances.
4. **Partition/archive old `ExecutionLog`/`AuditLog` rows** — these are the
   fastest-growing tables at scale (one row per node-attempt, per audit
   action) and are natural candidates for time-based partitioning or a
   periodic archive-to-cold-storage job once volume is high.
5. **Dead-letter queue** — implemented. The queue is declared with
   `x-dead-letter-exchange`; on an unhandled worker crash the message is
   `nack`'d (not `ack`'d) and routed to `workflow-executions-dlq` instead of
   being silently dropped. Normal node failures still `ack` with a `FAILED`
   status, which is correct (that's a legitimate terminal outcome, not a
   poison message). Remaining gap: no automated alerting/replay tooling on
   the DLQ itself — messages land there for manual inspection via the
   CloudAMQP dashboard only.
6. **Priority queues** — implemented (`x-max-priority`, default priority 5
   on standard runs); not yet exposed in any UI for a user to actually pick
   a priority when triggering a run — currently only settable by whoever
   calls `triggerWorkflowRun` with an explicit priority argument in code.

## Feature-level future improvements (beyond MVP scope)

- **Workflow version diff/rollback UI** — implemented. Paginated version
  list, two-version checkbox selection with an Added/Removed/Modified diff
  modal, and one-click restore (which itself creates a new version).
- **Email delivery for invitations** — still not implemented; invite links
  are shown in-app for manual copy/share. (Email *nodes* inside workflows
  are implemented via Resend — a different, already-solved integration —
  but invitation delivery specifically was never wired to it.)
- **True AI chat assistant** with real multi-turn conversational memory —
  still not built, remains distinct from the (now real) AI workflow
  generation and next-node-suggestion features, which are single-shot, not
  conversational.
- **AI workflow generation & next-node suggestion** — implemented.
  `POST /workflows/generate` turns a natural-language instruction into a
  validated, executable graph; `POST /workflows/:id/suggest-next` proposes
  follow-on nodes. **Full token-by-token streaming** is implemented for the
  AI Prompt node's live preview (`POST /ai/stream-test`, SSE) but not for
  workflow *generation* itself or for a node's output during an actual
  graph run — those remain request/response.
- **Elasticsearch (or Postgres `pg_trgm`/full-text `tsvector`)** for search —
  still `ILIKE`-based; unchanged gap.
- **Shared `packages/database` workspace package** — implemented. Prisma
  schema/client now live in one place, compiled via its own `tsc` build
  step (a real production bug was found and fixed in the process — see
  TRADEOFFS.md).
- **Per-API-key rate limiting** — implemented (60 req/min per key,
  in-memory). Global IP-based limiting still applies separately to
  cookie-session routes. Neither is Redis-backed yet (see "what would
  change first" below).
- **Dynamic, data-driven permission model** — implemented for
  create/update/delete/run/submit/evaluate/restore/share on
  workflows/forms/rules/files/flags via a `Permission` override table with
  a sane default-matrix fallback. Every mutating and privileged action now
  routes through `requirePermission`, not a hardcoded role list — the
  earlier partial-coverage gap (evaluate/restore/share still using static
  role checks) has been closed.
- **Real Conditional/Switch branching, SSRF guard, CSRF middleware
  ordering, cross-tenant IDOR fixes, Socket.io membership verification** —
  all implemented; formerly the most severe items on an external code
  review, now closed.
- **New node types (GitHub, Email, Switch, Loop, Database Query)** —
  implemented. Database Query is intentionally restricted to a small
  allowlist of the app's own tables (`workflows`, `forms`, `files`) scoped
  by the run's own `organizationId` — not arbitrary SQL, by design, to
  avoid reintroducing an injection/IDOR surface through a "convenience"
  node.
- **Cron-scheduled workflows** — implemented, but the scheduler is
  in-process (`node-cron`, re-synced from the DB at boot and whenever a
  schedule changes). A scheduled run due *during* a backend restart/cold
  start is missed, not queued for later — a persistent job scheduler
  (`pg-boss`, or an external cron hitting a webhook) would close this gap.
  No dedicated UI to set a schedule yet — API-only for now.
- **Notification grouping** — implemented (consecutive same-`groupKey`
  notifications collapse in the UI). **@mentions** are supported only via
  structured rule-action config (`mentionUserId`), not free-text `@name`
  parsing in messages — a deliberate simplification, not an oversight.
- **Real dot-path field resolution in the Rule Engine** — implemented
  (`candidate.experience`, not just top-level keys); this was a real
  correctness bug (rules against nested JSON silently always failed to
  match) found during manual testing and fixed.
- **Real-time collaborative canvas editing** (CRDT) — still not built.
- **Mobile PWA support** — still not built.
- **Second, dev-dedicated GitHub OAuth App** — still not set up; unchanged
  gap (see TRADEOFFS.md).
- **Form repeating groups** — implemented (repeatable text fields with
  add/remove). Form **file-upload fields** remain UI-only, not wired to
  real file storage — a real, still-open gap.
- **Prometheus metrics** — implemented. `GET /metrics` (outside `/api/v1`,
  no auth — matches standard scrape-endpoint convention) exposes real
  `prom-client` counters and a histogram: total HTTP requests by
  method/route/status, HTTP request duration, and total workflow runs by
  final status. This is genuine, scrapable Prometheus-format output, not a
  stub. **Grafana specifically is still not built** — no dashboard exists
  to visualize these metrics, only the raw scrape endpoint. `GET /health`
  remains the separate, simpler up/down check used by keep-alive pings.
- **Request validation (Zod)** — extended beyond auth/organization/workflow
  to forms, rules, and feature flags' mutating routes. File upload routes
  use `multipart/form-data`, validated via MIME-type/size checks in
  `fileService.ts` instead (Zod body validation doesn't apply the same way
  to multipart bodies).
- **Regression tests for bugs found during manual testing** — added
  specifically for: the rule evaluator's vacuous-truth bug (an empty
  AND/OR group previously matched anything), dot-path field resolution
  against nested JSON, a full nested AND/OR tree against realistic data,
  the graph executor correctly reporting `SUCCESS` (not `PARTIAL`) when a
  conditional branch is legitimately skipped vs. `FAILED`/`PARTIAL` on a
  genuine upstream failure, the dynamic permission model's override-vs-
  default-matrix fallback, and the SSRF guard's actual IP/protocol
  blocklist. These were each real bugs caught by manual click-through
  testing with zero prior automated coverage — now they have it.

## What would change first if this became a real product

In rough priority order: (1) move rate limiting (both global and per-API-key)
and the AI response cache to Redis, since those are the two remaining pieces
of hidden per-process state that silently break correctness the moment
there's more than one instance of anything; (2) replace the in-process cron
scheduler with a persistent one so scheduled runs survive a restart window;
(3) wire transactional email delivery for org invitations (still just a
copy/share link today); (4) build a Grafana dashboard against the now-real
`/metrics` endpoint for actual trend/alerting visibility, since the raw
scrape endpoint alone doesn't give that; (5) extend Zod validation to file
routes' non-body fields (e.g. query params) for full input-validation
symmetry.
