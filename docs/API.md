# Project Atlas — API Documentation

Base URL (local): `http://localhost:4000/api/v1`
Base URL (production): `https://project-atlas-vupz.onrender.com/api/v1`

All endpoints below require the `X-Organization-Id` header **except** where
noted, and require an authenticated session (httpOnly cookies) except where
marked **Public** or **API-key**. All state-changing requests (POST/PATCH/DELETE)
require a CSRF token, obtained via `GET /csrf-token` and sent back as the
`x-csrf-token` header — the frontend's `api.ts` axios interceptor does this
automatically.

## Auth (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account (email/password), sets cookies |
| POST | `/auth/login` | Public | Password login, sets cookies |
| POST | `/auth/refresh` | Cookie (refresh token) | Rotates access+refresh tokens |
| POST | `/auth/logout` | Cookie | Revokes current refresh token, clears cookies |
| GET | `/auth/google` | Public | Starts Google OAuth flow |
| GET | `/auth/google/callback` | Public | Google OAuth callback, sets cookies, redirects to frontend |
| GET | `/auth/github` | Public | Starts GitHub OAuth flow |
| GET | `/auth/github/callback` | Public | GitHub OAuth callback, sets cookies, redirects to frontend |
| GET | `/auth/me` | Session | Returns current user id/email — used by frontend route guards |

## Organizations (`/organizations`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/organizations` | Session | Create org, creator becomes OWNER |
| GET | `/organizations` | Session | List orgs the user belongs to, with role |
| GET | `/organizations/members` | Session + Tenant | List members of active org |
| PATCH | `/organizations/:orgId` | OWNER only | Rename organization |
| POST | `/organizations/:orgId/invitations` | OWNER/ADMIN | Create invite, returns token |
| POST | `/invitations/:token/accept` | Session | Accept invite, creates/updates membership |
| PATCH | `/organizations/:orgId/members/:userId/role` | OWNER only | Change a member's role |
| DELETE | `/organizations/:orgId/members/:userId` | OWNER/ADMIN | Remove a member |

## Workflows (`/workflows`)

Mutating routes are gated by the dynamic permission model
(`requirePermission("workflow", <action>)`), not a hardcoded role list — see
ARCHITECTURE.md.

| Method | Path | Description |
|---|---|---|
| GET | `/workflows` | List org's workflows |
| GET | `/workflows/:id` | Get one workflow |
| POST | `/workflows` | Create (empty graph), generates a `webhookToken` |
| PATCH | `/workflows/:id` | Save graph — also writes a `WorkflowVersion` snapshot |
| DELETE | `/workflows/:id` | Soft delete |
| POST | `/workflows/:id/run` | Trigger execution — returns `202` + `runId` immediately. `403` if the graph contains an AI node and the `ai_node_enabled` feature flag is off for this org. |
| GET | `/workflows/:id/runs` | List execution runs with logs |
| GET | `/workflows/:id/runs/:runId` | Get one run with logs |
| GET | `/workflows/:id/versions?page=` | Paginated version history |
| POST | `/workflows/:id/versions/:versionId/restore` | Restore a version (creates a new version from it) |
| PATCH | `/workflows/:id/schedule` | Set/clear a cron schedule (`cronSchedule` body field, validated); no dedicated frontend UI yet — API only |

## AI Workflow Generation (`/workflows/generate`, `/workflows/:id/suggest-next`, `/ai/stream-test`)

| Method | Path | Description |
|---|---|---|
| POST | `/workflows/generate` | Body: `{ instruction }`. Generates and creates a new workflow (validated node kinds/edges) via Gemini from a natural-language description. |
| POST | `/workflows/:id/suggest-next` | Body: `{ instruction? }`. Returns up to 3 AI-suggested next nodes `{ kind, label, reason }` for the given workflow's current graph. |
| POST | `/ai/stream-test` | Body: `{ prompt }`. **Server-Sent Events** response — streams an AI Prompt preview token-chunk by token-chunk. CSRF-exempt (read-only preview, no mutation). |

## Webhooks (`/webhooks`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/webhooks/:token` | **Public** — the token itself is the secret | Triggers a run for the workflow owning that `webhookToken`. Request body becomes `trigger_payload` in the run's variables. CSRF-exempt (external caller, no session). |

## Public API (`/public`) — API-key authenticated, for external integrations

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/public/workflows` | API-key | List workflows for the key's organization |
| POST | `/public/workflows/:id/run` | API-key | Trigger a run |

Send header `X-API-Key: <raw key>`. Subject to a per-key rate limit (60
requests/minute) in addition to any global limiting.

## Forms (`/forms`)

| Method | Path | Description |
|---|---|---|
| GET | `/forms` | List forms |
| GET | `/forms/:id` | Get one form |
| POST | `/forms` | Create (empty fields) |
| PATCH | `/forms/:id` | Save field definitions |
| POST | `/forms/:id/submit` | Submit data — validated server-side against field defs |
| GET | `/forms/:id/submissions` | List submissions |

## Rules (`/rules`)

| Method | Path | Description |
|---|---|---|
| GET | `/rules` | List rules |
| POST | `/rules` | Create (empty AND group) |
| PATCH | `/rules/:id` | Update conditions/action/isActive |
| DELETE | `/rules/:id` | Delete |
| POST | `/rules/:id/evaluate` | Test a rule against arbitrary JSON data |

## Audit Log (`/audit-logs`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/audit-logs?page=&limit=` | OWNER/ADMIN | Paginated audit trail |

## Analytics (`/analytics`)

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/overview` | Total runs, success rate, avg duration, workflow/member counts |
| GET | `/analytics/node-usage` | Node-kind breakdown across all saved workflows |
| GET | `/analytics/daily-executions` | Execution counts, last 14 days |
| GET | `/analytics/active-users` | Top 5 most active users by audit-log volume |

## Files (`/files`)

| Method | Path | Description |
|---|---|---|
| GET | `/files` | List files |
| POST | `/files` | Upload (multipart `form-data`, field name `file`; optional `replacesFileId` for versioning) |
| GET | `/files/:id/download-url` | Returns a signed, time-limited R2 download URL |
| DELETE | `/files/:id` | Soft delete |
| POST | `/files/:id/restore` | Undo soft delete |
| POST | `/files/:id/share` | Create expiring share link (`expiresInHours`, default 24) |
| GET | `/share/:token` | **Public** — resolves a share link to a download URL, no auth/org header |

## API Keys (`/api-keys`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api-keys` | OWNER/ADMIN | List keys (prefix only, never raw) |
| POST | `/api-keys` | OWNER/ADMIN | Create key — raw value returned **once** |
| DELETE | `/api-keys/:id` | OWNER/ADMIN | Revoke |
| GET | `/api-keys/usage` | Session | Total + last-24h request counts |

**API-key authenticated routes** are real and mounted: `GET
/public/workflows` and `POST /public/workflows/:id/run` (see above),
authenticated via `X-API-Key` and rate-limited per key. This closes what was
previously a documented gap (key management existed without any route
actually requiring the key).

## Feature Flags (`/feature-flags`)

| Method | Path | Description |
|---|---|---|
| GET | `/feature-flags` | List all flags (platform-level, not org-scoped) |
| POST | `/feature-flags` | Create |
| PATCH | `/feature-flags/:id` | Update `isGloballyEnabled` / `rolloutPercentage` / `targetOrgIds` |
| DELETE | `/feature-flags/:id` | Delete |
| GET | `/feature-flags/evaluate` | Resolved `{key: boolean}` map for the active org |

## Search (`/search`)

| Method | Path | Description |
|---|---|---|
| GET | `/search?q=` | Cross-module search via Postgres `ILIKE`: workflows, forms, rules, files, members, audit log actions, and API key names. Organizations and execution logs specifically are not yet indexed (spec also lists these — a real, small remaining gap). |

## Notifications (`/notifications`)

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List (last 50) — org-wide broadcasts + user-specific |
| PATCH | `/notifications/:id/read` | Mark one as read |
| POST | `/notifications/read-all` | Mark all as read |

Real-time delivery is via **Socket.io**, not polling — the REST endpoints
above are for initial load / catch-up only. Client connects, sends
`join-org` with the active org ID after the server confirms the httpOnly
cookie is valid, then listens for `notification` events.

## Internal (`/internal`) — service-to-service, authenticated

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/internal/notify` | `X-Internal-Secret` header (shared secret, `INTERNAL_SERVICE_SECRET` env var) | Called by the worker on run completion to trigger a notification. Previously unauthenticated — fixed. |

## Health & Docs

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Checks both DB (`SELECT 1`) and RabbitMQ channel connectivity; returns `503` if either is down, `200` with `status: "ok"` if both are up. Used by uptime monitors / keep-alive pings. |
| GET | `/metrics` | Public, no auth (standard scrape-endpoint convention). Prometheus-format output via `prom-client`: HTTP request count/duration by method/route/status, workflow run count by final status. Not under `/api/v1`. No Grafana dashboard is built against this yet. |
| GET | `/csrf-token` | Public. Issues a CSRF token/cookie pair; required before any mutating request. |
| GET | `/api/docs` | Live Swagger/OpenAPI UI (not under `/api/v1`). |
