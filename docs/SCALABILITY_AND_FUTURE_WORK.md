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
- **Priority queues, retries, idempotent consumers, and dead-letter queues**
  allow the execution engine to tolerate transient failures while preventing
  duplicate side effects from message redelivery.
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
2. **Move the in-memory AI response cache and rate limiter to Redis.** Both
   are intentionally process-local today (see TRADEOFFS.md). This is
   sufficient for the current deployment but would need to become a shared
   Redis-backed cache/store before horizontally scaling backend or worker
   replicas.
3. **Connection pooling** — currently relying on Prisma's default pool per
   process; at higher concurrency this should move to PgBouncer or a managed
   pooler (Render Postgres / Neon both offer this) to avoid exhausting
   Postgres's max connections across many worker instances.
4. **Partition/archive old `ExecutionLog`/`AuditLog` rows** — these are the
   fastest-growing tables at scale (one row per node-attempt, per audit
   action) and are natural candidates for time-based partitioning or a
   periodic archive-to-cold-storage job once volume is high.

## Feature-level future improvements (beyond MVP scope)

- **Email delivery for invitations** — wire up Resend/SES instead of the
  current copy-the-link-manually flow.
- **True AI chat assistant** with real multi-turn conversational memory,
  as a feature distinct from the stateless workflow AI node (see
  TRADEOFFS.md for why these are intentionally separate concerns).
- **Elasticsearch (or Postgres `pg_trgm`/full-text `tsvector`)** for search,
  once result-ranking quality or data volume outgrows simple `ILIKE`.
- **Organization and audit-log search** — the current search indexes
  workflows, forms, rules, files, and members. Extending it to organizations
  and audit logs would complete the search surface.
- **Workflow compensation / rollback execution** — the engine currently
  supports retries, partial-success execution, skipped downstream branches,
  and dead-letter queues, but it does not execute compensating actions to
  undo already-completed side effects when a later node fails.
- **Prometheus + Grafana observability** — structured logging and health
  checks already exist, but production metrics, dashboards, and alerting
  remain intentionally out of scope.
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

## What would change first if this became a real product

In rough priority order:

1. Move the in-memory AI response cache and rate limiter to Redis, since
   those are the two remaining pieces of hidden per-process state that stop
   scaling cleanly across multiple backend or worker instances.
2. Add Prometheus metrics, Grafana dashboards, and production alerting for
   observability beyond structured logs and health checks.
3. Extend cross-module search to include organizations and audit logs.
4. Implement compensating workflow rollback for node types that support undo
   semantics.
5. Continue optimizing database indexing, partitioning, and archival as
   execution history grows.