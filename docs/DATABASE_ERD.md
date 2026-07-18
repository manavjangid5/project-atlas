# Project Atlas — Database ER Documentation

Single PostgreSQL database, accessed exclusively through Prisma ORM. Schema
lives at `apps/backend/prisma/schema.prisma`; the worker imports the same
generated client as a direct dependency (see TRADEOFFS.md).

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
- Has many: `versions (WorkflowVersion)`, `runs (ExecutionRun)`

**WorkflowVersion**
- `id, workflowId, graph (Json snapshot), version (int, incrementing), createdAt`
- Written automatically on every `PATCH /workflows/:id` graph save — full
  history exists even though a diff/rollback UI hasn't been built yet.

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
showIf?: { fieldId, equals } }`.

### Rule Engine

**Rule**
- `id, name, conditions (Json — nested AND/OR tree), action (Json), isActive, organizationId, createdAt, updatedAt`

Condition tree shape: either a leaf `{ type: "condition", field, operator,
value }` or a group `{ type: "group", logic: "AND"|"OR", children: [...] }`,
arbitrarily nestable. Evaluated recursively by `ruleEvaluator.ts`.

### Notifications & Audit

**Notification**
- `id, organizationId, userId? (null = org-wide broadcast), title, message, priority (low|normal|high), readAt?, createdAt`

**AuditLog**
- `id, action, userId?, organizationId?, metadata (Json)?, createdAt`
- Actions logged: `USER_LOGIN`, `WORKFLOW_UPDATED`, `WORKFLOW_EXECUTED`,
  `ROLE_UPDATED`, `FORM_UPDATED`, `RULE_UPDATED`, `FILE_UPLOADED`.

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

### Feature Flags

**FeatureFlag** (platform-level, not organization-scoped)
- `id, key (unique), description?, isGloballyEnabled, rolloutPercentage (0-100), targetOrgIds (string[]), createdAt, updatedAt`
- Rollout is deterministic per-org (MD5 hash of `flagKey:orgId` bucketed
  0-99) rather than random per-request, so a given org never flickers
  between enabled/disabled across requests.

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
