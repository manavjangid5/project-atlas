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
2. **Move the AI response cache and rate limiter to Redis** (Upstash Redis
   free tier is already part of the planned stack) — required the moment
   there's more than one backend/worker instance, since in-memory state
   doesn't share across processes.
3. **Connection pooling** — currently relying on Prisma's default pool per
   process; at higher concurrency this should move to PgBouncer or a managed
   pooler (Render Postgres / Neon both offer this) to avoid exhausting
   Postgres's max connections across many worker instances.
4. **Partition/archive old `ExecutionLog`/`AuditLog` rows** — these are the
   fastest-growing tables at scale (one row per node-attempt, per audit
   action) and are natural candidates for time-based partitioning or a
   periodic archive-to-cold-storage job once volume is high.
5. **Dead-letter queue** for the RabbitMQ consumer — currently a message is
   `ack`'d even on unhandled crash (to avoid infinite requeue loops), which
   means a genuinely malformed message is silently dropped rather than
   captured for inspection. A proper DLQ would catch these for manual review
   without blocking the main queue.

## Feature-level future improvements (beyond MVP scope)

- **Workflow version diff/rollback UI** — the data (`WorkflowVersion` table)
  already exists; needs a comparison view and a "restore this version" action.
- **Email delivery for invitations** — wire up Resend/SES instead of the
  current copy-the-link-manually flow.
- **True AI chat assistant** with real multi-turn conversational memory,
  as a feature distinct from the stateless workflow AI node (see
  TRADEOFFS.md for why these are intentionally separate concerns).
- **Elasticsearch (or Postgres `pg_trgm`/full-text `tsvector`)** for search,
  once result-ranking quality or data volume outgrows simple `ILIKE`.
- **Shared `packages/database` workspace package** — extract Prisma schema
  and generated client into a proper shared package consumed by both
  `apps/backend` and `apps/worker`, removing the current dual-generation
  setup (see TRADEOFFS.md).
- **Per-organization API rate limiting** using issued API keys, beyond the
  current global IP-based limiter — natural extension of the existing
  `ApiKey`/`ApiUsageLog` tables.
- **Workflow marketplace / template library** and **plugin system for custom
  node types** — both listed as bonus features in the original spec; the
  node-executor architecture (`executeNode(kind, config, ctx)`) is already a
  clean seam for adding new node kinds without touching the graph executor.
- **Real-time collaborative canvas editing** (multiple users editing the same
  workflow simultaneously) — would build on the existing Socket.io
  infrastructure, using operational-transform or CRDT logic for the React
  Flow graph state.
- **Mobile PWA support** for the frontend.
- **Second, dev-dedicated GitHub OAuth App** so local GitHub login and
  production GitHub login can coexist (see TRADEOFFS.md).
- **Internal-service auth** (shared secret header) on the worker→backend
  `/internal/notify` endpoint, closing the one currently-unauthenticated
  internal route.

## What would change first if this became a real product

In rough priority order: (1) move rate limiting + AI cache to Redis, since
those are the two pieces of hidden per-process state that silently break
correctness the moment there's more than one instance of anything; (2) add
the internal-service auth header; (3) extract the shared Prisma package;
(4) add a dead-letter queue; (5) build the version diff/rollback UI, since
it's the highest-value feature that's fully data-ready but UI-incomplete.
