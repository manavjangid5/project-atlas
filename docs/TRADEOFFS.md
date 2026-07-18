# Project Atlas — Tradeoffs & Decisions

Chronological-ish list of real decisions made during the build, why, and what
the honest cost of each one is. Written for a reviewer who wants to see
*conscious* scoping rather than assume gaps are oversights.

## Infrastructure pivots (things that changed mid-build, not by choice)

**Render Background Worker (free) → Worker-as-Web-Service hack.** Render
removed the free tier for its dedicated Background Worker service type
mid-project. Rather than pay $7/mo, the worker runs as a free Web Service with
a trivial HTTP health server bolted on (`healthServer.ts`) purely to satisfy
Render's port-binding requirement, while the real RabbitMQ consumer runs in
the same process. Real cost: free Web Services spin down after 15 min idle,
so the worker can go to sleep and stop consuming the queue until woken by an
incoming request — mitigated with an external keep-alive cron ping, but this
is a genuine limitation worth naming explicitly rather than hiding.

**Prisma / TypeScript / Vite / Express-ecosystem version pinning.** Multiple
times during the build, `pnpm add <package>` (no version specified) resolved
to a brand-new, still-unstable major version (Prisma 7, TypeScript 7,
rolldown-based Vite, `@vitejs/plugin-react@6`) that broke tooling in ways
unrelated to the app's own code. Every one of these was fixed by explicitly
pinning to the last known-stable major version (Prisma 6.19.3, TypeScript
5.6.3, Vite 5.4.10, plugin-react 4.3.4) rather than chasing the bleeding edge
mid-assignment. Documented here as a reusable lesson, not just a one-off fix.

## Deliberate scope decisions

**AI nodes are stateless per call.** No cross-node conversational memory —
context between AI Prompt nodes is passed explicitly via
`{node-id_output}` template variables, matching how n8n/Zapier/GitHub Actions
pass data between pipeline steps. True multi-turn chat memory (a running
message history sent to Gemini each call) was scoped as a separate future
"AI chat assistant" bonus feature rather than bolted onto the workflow node,
because a workflow engine and a chatbot have fundamentally different state
models — conflating them would have made the execution engine harder to
reason about (is a node's output deterministic given its inputs, or does it
depend on invisible prior chat state?). This was an architectural boundary
decision, not a time-constraint shortcut.

**Global search uses Postgres `ILIKE`, not Elasticsearch.** The spec
explicitly allows either. Elasticsearch would have added a whole extra
service to provision, deploy, and pay for hosting on, for a search surface
that (at this data scale) Postgres handles fine. Documented tradeoff: this
won't scale gracefully to true full-text relevance ranking or fuzzy matching
at large data volumes — `pg_trgm`/`tsvector` or a real search service would
be the production upgrade path (see SCALABILITY_AND_FUTURE_WORK.md).

**Workflow versioning: storage exists, diff/rollback UI does not.** Every
graph save writes a full `WorkflowVersion` snapshot from day one (no
retrofitting needed later), but the frontend never got a "compare version A
vs B" or "roll back to version N" screen. The data model fully supports it —
this is a UI-only gap, explicitly deferred to keep pace with the timeline.

**Feature flags are platform-level, not per-organization tables.** A flag's
per-org behavior is controlled by `targetOrgIds[]` and a deterministic
percentage-rollout hash, rather than a separate `OrganizationFeatureFlag`
join table. Simpler schema, satisfies "globally or for specific
organizations" from the spec, at the cost of flags not being independently
manageable per-org by non-platform-admins (there's no "org admin can create
their own flags" concept — flags are a platform/ops concern here).

**Invitations have no email delivery.** `POST /organizations/:id/invitations`
creates a real token and DB row, but the invite link is just displayed in the
UI for the inviter to copy/share manually — no transactional email service
(SES/Resend/Postmark) is wired up. Documented as a clear "next thing to add"
rather than left ambiguous.

**Internal `/internal/notify` endpoint has no authentication.** The worker
calls this backend endpoint on run completion to trigger a real-time
notification. It's unauthenticated because in this deployment topology it's
only reachable via the worker's own outbound call, on a URL not exposed
anywhere in the frontend. Production hardening would add a shared
internal-service secret header (`X-Internal-Secret`) validated before
processing — flagged explicitly rather than silently left open.

**GitHub OAuth uses a single callback URL.** Unlike Google (which allows
multiple redirect URIs per client), GitHub OAuth Apps support exactly one
callback URL. Choosing to point it at production means local GitHub login
breaks (Google login still works locally). The alternative — a second,
dev-only GitHub OAuth App — was noted but not set up, given time constraints;
trivial to add later.

**Worker's Prisma Client is a direct dependency, not a shared workspace
package.** `apps/worker` lists `@prisma/client` in its own `package.json`
(pinned to the same version as backend) and points its own `prisma generate`
at the backend's schema file via `--schema=../backend/prisma/schema.prisma`.
This works correctly and is what's deployed, but the cleaner long-term
structure would be extracting a `packages/database` workspace package that
both `apps/backend` and `apps/worker` depend on, so there's exactly one
source of truth for the generated client rather than two independent
generation steps that happen to target the same schema file. Noted as the
first thing to refactor if this project continued past the assignment.

**Rate limiting is in-process (`express-rate-limit`), not Redis-backed.**
Fine for a single backend instance (current deployment topology). Would need
a shared Redis-backed limiter store the moment the backend scales to more
than one instance, since each instance would otherwise track limits
independently, effectively multiplying the real limit by the instance count.

**AI response cache is in-memory, per-worker-instance.** Resets on worker
restart/redeploy and isn't shared across multiple worker instances. Fine at
current scale; Redis would be the correct shared-cache backing store at
higher scale or with more than one worker replica.

## Testing scope

Unit tests cover the highest-value, highest-bug-risk logic specifically: the
rule evaluator (recursive AND/OR correctness), JWT/refresh-token utilities
(sign/verify/tamper-detection/hash-consistency), and the graph executor
(parallel execution, downstream-skip-on-failure). This is intentionally not
exhaustive line-coverage across every file — it targets the pieces where a
silent logic bug would be genuinely hard to notice by manual testing alone.
One Playwright e2e test covers the single most important user journey
end-to-end (login → build workflow → save → run → see result), rather than a
broad but shallow suite across every page.
