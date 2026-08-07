# Project Atlas — Database ER Documentation

Single PostgreSQL database, accessed exclusively through Prisma ORM. Schema
and generated client live in `packages/database` (a shared workspace
package — see ARCHITECTURE.md); both `apps/backend` and `apps/worker`
consume the same compiled client via `@atlas/database`, not two independent
generation steps.

## Entity groups

### Identity & Tenancy

**User**
- `id, email (unique), passwordHash?, googleId?, githubId?, name?, createdAt`
- Has many: `memberships`, `refreshTokens`, `auditLogs`

**Organization**
- `id, name, createdAt, updatedAt`
- Has many: `members (Membership)`, `workflows`, `auditLogs`, `invitations`,
  `formSchemas`, `rules`, `notifications`, `fileAssets`, `apiKeys`

**Membership** (join table: User ↔ Organization, with role)
- `id, role (OWNER|ADMIN|DEVELOPER|VIEWER), userId, organizationId, createdAt`
- `@@unique([userId, organizationId])` — one membership per user per org
- This is the row `requireTenant` middleware checks on every tenant-scoped
  request to enforce data isolation.

**Invitation**
- `id, email, role, token (unique), organizationId, invitedBy, acceptedAt?, expiresAt`
- Email delivery not implemented (invite link is displayed in-app to copy/share
  manually) — see TRADEOFFS.md.

**RefreshToken**
- `id, userId, tokenHash (unique, SHA-256), family, revokedAt?, replacedBy?, expiresAt`
- Raw token value is never stored — only its hash. `family` groups all tokens
  descended from one login, enabling reuse-detection revocation.

### Workflow Engine

**Workflow**
- `id, name, graph (Json — {nodes, edges}), isActive, organizationId, deletedAt? (soft delete), createdAt, updatedAt`
- `webhookToken (unique)` — secret token enabling external `POST /webhooks/:token` triggering, generated at creation.
- `cronSchedule?` — cron expression string; when set, the backend's in-process scheduler triggers a run automatically (see ARCHITECTURE.md for the durability caveat).
- Has many: `versions (WorkflowVersion)`, `runs (ExecutionRun)`

**WorkflowVersion**
- `id, workflowId, graph (Json snapshot), version (int, incrementing), createdAt`
- Written automatically on every `PATCH /workflows/:id` graph save. The
  frontend Versions panel reads this table directly for a paginated
  history, a two-version diff (Added/Removed/Modified nodes), and
  one-click restore (which itself creates a new version from the restored
  snapshot).

**ExecutionRun**
- `id, workflowId, status (PENDING|RUNNING|SUCCESS|FAILED|PARTIAL), startedAt, finishedAt?`
- Has many: `logs (ExecutionLog)`

**ExecutionLog**
- `id, runId, nodeId, status (SUCCESS|FAILED|RETRYING|SKIPPED), message?, createdAt`
- One row per node execution attempt — the retry loop writes a `RETRYING`
  row per failed attempt before the final `SUCCESS`/`FAILED` row.

### Forms

**FormSchema**
- `id, name, fields (Json — array of field defs), organizationId, createdAt, updatedAt`
- Has many: `submissions (FormSubmission)`

**FormSubmission**
- `id, formId, data (Json), submittedBy?, createdAt`

Field definition shape (stored in `fields` Json, not a separate table —
dynamic schema by design): `{ id, label, type, required?, options?,
showIf?: { fieldId, equals }, repeatable? }`. `repeatable` fields render as
an "Add another" list in the frontend and submit as an array value rather
than a scalar. `file`-type fields exist in the schema and builder UI but are
not yet wired to real upload/storage (honest gap, see TRADEOFFS.md).

### Rule Engine

**Rule**
- `id, name, conditions (Json — nested AND/OR tree), action (Json), isActive, organizationId, createdAt, updatedAt`

Condition tree shape: either a leaf `{ type: "condition", field, operator,
value }` or a group `{ type: "group", logic: "AND"|"OR", children: [...] }`,
arbitrarily nestable. Evaluated recursively by `ruleEvaluator.ts`, which
resolves `field` as a **dot-path** into the evaluated data (e.g.
`candidate.experience` reaches into nested JSON, not just top-level keys —
an earlier version only supported flat top-level fields, which meant rules
against realistic nested payloads silently never matched; fixed).

`action` (`{ kind: "NOTIFY"|"TRIGGER_WORKFLOW"|"NONE", message?, workflowId?,
mentionUserId? }`) is not just stored — `formService.submitForm` evaluates
every active rule in the org against the submission data on every real
submission and actually fires the matched action (creates a notification or
triggers another workflow run), not just in the standalone test panel.

### Notifications & Audit

**Notification**
- `id, organizationId, userId? (null = org-wide broadcast), title, message, priority (low|normal|high), readAt?, createdAt`
- `groupKey?` — e.g. `workflow:<id>`; consecutive notifications sharing a
  groupKey are collapsed into one grouped entry in the frontend rather than
  shown as separate rows.
- `mentionedUserId?` — set when a rule action explicitly targets a specific
  user (`mentionUserId` in the rule's action config); emits an additional
  `mention` socket event to that user's room. Not free-text `@name` parsing.

**AuditLog**
- `id, action, userId?, organizationId?, metadata (Json)?, createdAt`
- Actions logged include: `USER_LOGIN`, `WORKFLOW_UPDATED`,
  `WORKFLOW_EXECUTED`, `WORKFLOW_AI_GENERATED`, `ROLE_UPDATED`,
  `FORM_UPDATED`, `RULE_UPDATED`, `FILE_UPLOADED`.

### Files

**FileAsset**
- `id, fileName, mimeType, sizeBytes, storageKey (R2 object path), version (int), organizationId, uploadedBy?, deletedAt? (soft delete), createdAt`
- Has many: `shareLinks (FileShareLink)`
- New uploads against an existing file increment `version` — simple
  version history without a separate versions table.

**FileShareLink**
- `id, fileId, token (unique), expiresAt, createdAt`
- Resolved via a public, unauthenticated route (`GET /share/:token`) that
  returns a time-limited signed R2 download URL.

### API Gateway

**ApiKey**
- `id, name, keyHash (unique, SHA-256), keyPrefix (first 14 chars, shown to user), organizationId, lastUsedAt?, revokedAt?, createdAt`
- Has many: `usageLogs (ApiUsageLog)`
- Raw key is shown to the user exactly once, at creation — matches Stripe/GitHub
  token conventions.

**ApiUsageLog**
- `id, apiKeyId, endpoint, method, statusCode, createdAt`
- Written on every successful `requireApiKey`-authenticated request. Note:
  the actual rate-limit enforcement (60 req/min per key) is a separate,
  in-memory sliding-window check in the middleware itself — this table is
  the usage *record*, not the limiter's own state (see TRADEOFFS.md).

### Feature Flags

**FeatureFlag** (platform-level, not organization-scoped)
- `id, key (unique), description?, isGloballyEnabled, rolloutPercentage (0-100), targetOrgIds (string[]), createdAt, updatedAt`
- Rollout is deterministic per-org (MD5 hash of `flagKey:orgId` bucketed
  0-99) rather than random per-request, so a given org never flickers
  between enabled/disabled across requests.

### Dynamic Permissions

**Permission** (organization-level override table — the actual mechanism
behind the spec's "permissions must be dynamic rather than hardcoded"
requirement)
- `id, organizationId, role (Role), resource (string), action (string), allowed (Boolean), @@unique([organizationId, role, resource, action])`
- Checked by `requirePermission(resource, action)` middleware before a
  built-in default role/resource/action matrix is consulted as a fallback.
  An Owner can insert a row here to grant or restrict a specific role's
  access to a specific resource/action for their org, with no code change
  or redeploy required. Not every route uses this yet — a handful of
  lower-stakes actions (evaluate a rule, restore/share a file, restore a
  workflow version) still use static `requireTenantRole` checks (see
  TRADEOFFS.md).

## Relationships summary (text ERD)

```
User ──< Membership >── Organization
User ──< RefreshToken
User ──< AuditLog (nullable FK)

Organization ──< Workflow ──< WorkflowVersion
Organization ──< Workflow ──< ExecutionRun ──< ExecutionLog
Organization ──< Invitation
Organization ──< FormSchema ──< FormSubmission
Organization ──< Rule
Organization ──< Notification (userId nullable = broadcast)
Organization ──< AuditLog (nullable FK)
Organization ──< FileAsset ──< FileShareLink
Organization ──< ApiKey ──< ApiUsageLog
Organization ──< Permission (role/resource/action override rows)

FeatureFlag  (standalone — targets orgs via targetOrgIds[] array, not a FK)
```

## Indexing & data-integrity notes

- Every organization-scoped table has an index on `organizationId` (the
  column every tenant-scoped query filters on first).
- `Membership` has a compound unique constraint on `(userId, organizationId)`
  — structurally prevents duplicate memberships.
- Soft deletes (`deletedAt`) are used on `Workflow` and `FileAsset` where
  recovery matters; hard deletes are used elsewhere (Membership removal,
  API key rows are *revoked* not deleted, Rule/FormSchema deletion) as a
  deliberate per-entity choice.
- All multi-step writes that must be atomic (org creation + owner membership,
  workflow graph update + version snapshot, invitation acceptance + membership
  upsert) use `prisma.$transaction`.
