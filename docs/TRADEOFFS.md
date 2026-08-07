# Project Atlas — Tradeoffs & Decisions

Chronological-ish list of real decisions made during the build, why, and what
the honest cost of each one is. Written for a reviewer who wants to see
*conscious* scoping rather than assume gaps are oversights.

## Infrastructure pivots (things that changed mid-build, not by choice)

**Kafka → RabbitMQ.** Originally planned Upstash Kafka (free, serverless) per
the assignment's own tech stack table (`RabbitMQ / Kafka`). Discovered mid-build
that Upstash fully discontinued their Kafka product in March 2025. Pivoted to
RabbitMQ via CloudAMQP's free tier — the other explicitly-allowed option in
the spec. Cost: rebuilt the producer/consumer layer once (`kafkajs` →
`amqplib`); the graph-executor logic itself was untouched since it only
depends on receiving a JSON message, not the transport.

**Render Background Worker (free) → Worker-as-Web-Service hack.** Render
removed the free tier for its dedicated Background Worker service type
mid-project. Rather than pay $7/mo, the worker runs as a free Web Service with
a trivial HTTP health server bolted on (`healthServer.ts`) purely to satisfy
Render's port-binding requirement, while the real RabbitMQ consumer runs in
the same process. Real cost: free Web Services spin down after 15 min idle,
so the worker can go to sleep and stop consuming the queue until woken by an
incoming request — mitigated with a code-based mutual keep-alive between
backend and worker (in-process `setInterval` ping every 10 minutes, see
DEPLOYMENT.md). An external cron-based backstop was considered but never
actually set up, so this mitigation has the honest edge case that if both
services spin down simultaneously, nothing wakes them until a real request
arrives — a genuine limitation worth naming explicitly rather than hiding.

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

**Workflow versioning: diff/rollback UI — was a gap, now built.** Every
graph save writes a full `WorkflowVersion` snapshot. The frontend now has a
paginated version list, a two-version diff view (Added/Removed/Modified
nodes), and one-click restore. Remaining honest limitation: the diff is
structural (which nodes changed), not a field-by-field config diff within a
single modified node — if you want to know *exactly* what changed inside one
node's config, you still have to open both versions' raw graphs.

**Dynamic permission model now covers every mutating/privileged action —
was a partial-coverage gap, now closed.** `requirePermission(resource,
action)`, backed by an org-overridable `Permission` table with a sane
default-matrix fallback, governs create/update/delete/run/submit **and**
evaluate/restore/share across workflows, forms, rules, files, and feature
flags. The earlier version left a handful of lower-stakes actions (rule
evaluate, file restore/share, workflow version restore) on the older static
`requireTenantRole` check; those were extended to the dynamic model too,
so there's now exactly one permission mechanism in the codebase, not two.

**Cron-scheduled workflows use an in-process scheduler, not a persistent
job queue.** `node-cron` jobs are registered in-memory at backend boot and
re-synced whenever a schedule changes, reading from the `Workflow.cronSchedule`
column. This is honest, working code — but a run whose scheduled time falls
*during* a backend restart or Render cold-start window is missed entirely,
not queued for later execution. A production system would use a durable
scheduler (e.g. `pg-boss`, or an external cron service hitting the existing
webhook endpoint) so scheduled runs survive process restarts.

**Per-API-key rate limiting is in-memory, same caveat as the global
limiter.** `requireApiKey` enforces 60 requests/minute per key via an
in-process `Map`, which (like the global rate limiter) resets on restart and
doesn't share state across multiple backend instances. Same Redis-migration
path applies to both.

**Database Query node is restricted to an explicit table allowlist, not
arbitrary SQL.** The node only permits reads against `workflows`, `forms`,
and `files`, always scoped by the executing run's own `organizationId` —
this was a deliberate security boundary, not a missing feature. A "run any
SQL" node would reopen exactly the injection/IDOR surface the rest of the
app was hardened against.

**Form file-upload fields are UI-only.** The form builder lets you add a
`file`-type field and it renders a file input in the live preview, but
submissions don't actually upload the file anywhere (no R2 integration for
form-submitted files, distinct from the standalone Files module which is
fully real). A genuine gap, not represented as done anywhere else in the docs.

**Notification @mentions are structured, not free-text.** A rule's NOTIFY
action can target a specific user via a `mentionUserId` field in its config,
which triggers an additional real-time `mention` event to that user. There
is no `@username` parsing inside free-text notification messages — mentions
only happen where a feature explicitly wires them up (currently just rule
actions), not as a general text-parsing capability across the app.

**CSRF library version sensitivity.** The installed major version of
`csrf-csrf` requires an explicit `getTokenFromRequest` function in its
config — without it, the library silently fails to read the `x-csrf-token`
header correctly even when the client sends a matching, freshly-issued
token, producing a confusing "valid-looking token, still 403" failure mode
that took real debugging time to isolate. Documented here since it's a
non-obvious library-API-shape trap, not a logic bug in this codebase's own
code.

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

**Internal `/internal/notify` endpoint — was unauthenticated, now fixed.**
The worker calls this backend endpoint on run completion to trigger a
real-time notification. An earlier version left it open with no auth, which
a review correctly flagged as unacceptable for multi-tenant SaaS regardless
of deployment-topology assumptions. Fixed: both worker and backend now share
an `INTERNAL_SERVICE_SECRET` env var, checked via `requireInternalSecret`
middleware on the route and sent as an `X-Internal-Secret` header by the
worker's call.

**GitHub OAuth uses a single callback URL.** Unlike Google (which allows
multiple redirect URIs per client), GitHub OAuth Apps support exactly one
callback URL. Choosing to point it at production means local GitHub login
breaks (Google login still works locally). The alternative — a second,
dev-only GitHub OAuth App — was noted but not set up, given time constraints;
trivial to add later.

**`packages/database` extraction — and the bug it surfaced.** Prisma was
extracted into a shared `packages/database` workspace package consumed by
both `apps/backend` and `apps/worker`, closing the earlier "two independent
generation steps" gap. Extracting it surfaced a real production-only bug
worth documenting: the package's `package.json` initially pointed `main` at
raw `src/index.ts` instead of compiled output. Local dev (`ts-node-dev`)
executes TypeScript directly and never noticed; production (`node
dist/server.js`, plain Node) cannot execute `.ts` files at all, so the
`prisma` client silently resolved to `undefined` in some import paths in
production while appearing to work at server startup. Fixed by giving
`packages/database` its own real `tsc` build step, wired into both Render's
build commands and CI. Lesson: any shared internal package needs its own
compiled build step verified in a production-like (plain `node`, not
`ts-node`) context — dev tooling can mask a gap that only breaks at
deploy time.

**Rate limiting is in-process (`express-rate-limit`), not Redis-backed.**
Fine for a single backend instance (current deployment topology). Would need
a shared Redis-backed limiter store the moment the backend scales to more
than one instance, since each instance would otherwise track limits
independently, effectively multiplying the real limit by the instance count.

**AI response cache is in-memory, per-worker-instance.** Resets on worker
restart/redeploy and isn't shared across multiple worker instances. Fine at
current scale; Redis would be the correct shared-cache backing store at
higher scale or with more than one worker replica.

## Bugs found during manual smoke testing (and fixed)

A full manual click-through pass (see `docs/FINAL_SMOKE_TEST.md`) surfaced
several real correctness bugs that no automated test had caught — each is
now fixed and has regression coverage:

- **Rule evaluator vacuous truth.** JavaScript's `[].every(...)` returns
  `true` on an empty array, so an empty AND/OR condition group silently
  matched *any* input. Fixed to explicitly return `false` for empty groups.
- **Conditional branch skip counted as a failure.** A workflow run where a
  Conditional node correctly took one branch and skipped the other was
  reported as `PARTIAL`, implying something went wrong — nothing did. Fixed
  by distinguishing "skipped because the branch wasn't taken" from
  "skipped because an upstream node genuinely failed"; only the latter
  affects final run status.
- **Open node config panel didn't reflect undo/redo.** The panel captured
  a one-time snapshot of the clicked node instead of deriving it live from
  current canvas state, so undoing a node deletion correctly restored the
  node on the canvas but the (already-open) panel kept showing stale data.
  Fixed by deriving the displayed node from a live lookup by ID each render.
- **Audit log pagination was hardcoded to page 1.** The fetch call ignored
  the `page` state entirely; clicking Next/Previous changed the UI's page
  number but always requested page 1 from the API. Fixed.
- **Cross-page version comparison was impossible.** The version diff
  feature stored only selected *IDs*, which fell out of scope once you
  paginated away from the page they were fetched on. Fixed by storing the
  full selected version objects instead, so a selection made on one page
  survives navigating to another.
- **Form "Show only if" required an exact string match, and didn't apply
  to the first field.** Simplified to presence/truthy-based visibility
  (show once the referenced field has any value) per actual usage
  need, rather than requiring the field's value to equal a specific
  hardcoded comparison string.
- **Member role-change silently did nothing.** The frontend's
  `updateMemberRole` call was missing the `:orgId` URL segment the backend
  route actually requires, so it was hitting a route that doesn't exist.
  Blocked with no on-screen error until this call was traced.
- **Rule "Test" button could silently evaluate stale, unsaved data.**
  Editing a rule's conditions and clicking Test (without a separate Save
  click first) tested whatever was last actually persisted in the
  database, not what was on screen — confusing given there's no visible
  indicator of unsaved changes. Fixed by making Test always save current
  edits before evaluating.
- **A blocked workflow run (e.g. by a disabled feature flag) failed
  silently.** The `403` was visible in the browser console/network tab but
  nothing appeared on screen. Fixed to show the real error message via an
  alert.

These are listed here deliberately, not swept into a changelog, because
they're exactly the class of bug an external review would expect a project
at this stage to have already caught with tests — see "Testing scope" below
for what regression coverage was added as a direct result.

## Testing scope

Unit tests cover the highest-value, highest-bug-risk logic: the rule
evaluator (recursive AND/OR correctness, the empty-group vacuous-truth
guard, dot-path field resolution against nested JSON, and a full nested
AND/OR tree against realistic recruiter-style data — all real bugs found
and fixed during manual testing, listed above), JWT/refresh-token utilities
(sign/verify/tamper-detection/hash-consistency), the graph executor
(parallel execution, downstream-skip-on-failure, and — specifically —
correctly distinguishing a legitimately-skipped conditional branch, which
reports `SUCCESS`, from a genuine upstream failure, which reports
`FAILED`/`PARTIAL`), the dynamic permission model (org-override rows taking
precedence over the default role matrix, in both the granting and
restricting direction), and the SSRF guard (confirms it actually blocks
localhost, loopback, and the cloud metadata IP, and actually allows a
genuine public URL through). Integration tests (against a real, ephemeral
Postgres in CI) cover cross-tenant access denial (the core multi-tenancy
guarantee) and refresh-token rotation/reuse-detection revoking an entire
token family. A CSRF regression test confirms a mutating request without a
token is rejected. One Playwright e2e
test covers the single most important user journey end-to-end (login →
build workflow → save → run → see result). This is intentionally not
exhaustive line-coverage across every route or every frontend component —
it targets the pieces where a silent logic or security bug would be
genuinely hard to notice by manual testing alone. The full manual regression
script covering every feature (including the ones without automated tests)
lives in `docs/FINAL_SMOKE_TEST.md` and should be run before any deploy.

## On verification honesty specifically

Not every feature described across these docs has been independently
re-confirmed against the live deployed environment as of this writing — see
the "Verification status" section at the top of DEPLOYMENT.md for a precise
breakdown of what's confirmed live in production, what's configured but not
separately retested (e.g. GitHub OAuth), and what's built and verified only
via local testing pending a final deploy-and-click-through pass (most of the
AI generation/streaming, priority queue, cron, and dynamic-permission
features added in the later part of the build).
