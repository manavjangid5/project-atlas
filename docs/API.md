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

| Method | Path | Description |
|---|---|---|
| GET | `/workflows` | List org's workflows |
| GET | `/workflows/:id` | Get one workflow |
| POST | `/workflows` | Create (empty graph) |
| PATCH | `/workflows/:id` | Save graph — also writes a `WorkflowVersion` snapshot |
| DELETE | `/workflows/:id` | Soft delete |
| POST | `/workflows/:id/run` | Trigger execution — returns `202` + `runId` immediately |
| GET | `/workflows/:id/runs` | List execution runs with logs |
| GET | `/workflows/:id/runs/:runId` | Get one run with logs |

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

**API-key authenticated routes** (external/programmatic access, distinct from
cookie session auth): send header `X-API-Key: <raw key>`. Validated by the
`requireApiKey` middleware, which also logs usage per-request. No routes are
currently wired to use this middleware by default — it's available for any
route that should support external integrations.

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
| GET | `/search?q=` | Cross-module search (workflows, forms, rules, files, members) via Postgres `ILIKE` |

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

## Internal (`/internal`) — service-to-service, no auth

| Method | Path | Description |
|---|---|---|
| POST | `/internal/notify` | Called by the worker on run completion to trigger a notification. No auth — see TRADEOFFS.md for the documented reasoning and production hardening note. |

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | DB connectivity check, used by uptime monitors / keep-alive pings |
