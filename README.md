# Project Atlas

**AI-powered collaborative workflow automation platform** — a self-hosted alternative to Zapier/n8n with AI as a first-class node type (including natural-language workflow generation), built as a multi-tenant SaaS with dynamic permissions, dynamic forms, and a rules engine.

Observability is structured request logging (morgan) and per-node execution logs, plus a `/health` endpoint that checks DB and queue connectivity. There is no centralized metrics system — Prometheus/Grafana are not implemented (see TRADEOFFS.md).

🔗 **Live app:** https://project-atlas-frontend.onrender.com
🔗 **Live API:** https://project-atlas-vupz.onrender.com/api/v1/health
🔗 **API docs (Swagger):** https://project-atlas-vupz.onrender.com/api/docs

---

## What is this?

Project Atlas lets an organization visually design an automation — *"every morning, summarize yesterday's GitHub commits with AI and post it to Slack"* — on a drag-and-drop canvas, run it reliably with retries and full logs, and manage everything (members, forms, rules, files) inside one multi-tenant workspace. You can also **describe a workflow in plain English and have AI generate the graph for you.**

Full technical breakdown: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Zustand, Tailwind CSS (CSS-variable theming), React Flow, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma |
| Shared | `packages/database` — extracted Prisma schema/client, compiled and consumed by both backend and worker |
| Database | PostgreSQL |
| Message Queue | RabbitMQ (priority queues, dead-letter queue, idempotent consumer) |
| Auth | JWT (rotation + reuse detection), Google & GitHub OAuth, dynamic per-org permission model |
| AI | Google Gemini — node execution, streaming preview, and full workflow generation from natural language |
| Storage | Cloudflare R2 (S3-compatible) |
| Real-time | Socket.io (grouped/batched notifications) |
| Scheduling | In-process cron (node-cron) for scheduled workflow runs |
| Deployment | Render (frontend static site, backend + worker web services), GitHub Actions CI |

Docs: **[API.md](docs/API.md)** · **[DATABASE_ERD.md](docs/DATABASE_ERD.md)** · **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** · **[TRADEOFFS.md](docs/TRADEOFFS.md)** · **[SCALABILITY_AND_FUTURE_WORK.md](docs/SCALABILITY_AND_FUTURE_WORK.md)**

---

## Getting started (as a user)

1. **Register** (email/password, or Google/GitHub).
2. First login → create an **Organization**, you become its **Owner**.
3. Sidebar tabs:

### Workflows
Drag-and-drop canvas (React Flow). Node types: HTTP Request, Delay, Conditional (real true/false branching, not cosmetic), Slack, AI Prompt, Webhook, GitHub, Email (via Resend, sandbox-mode recipient restriction applies), Switch, Loop, Database Query. Click a node to configure it — the panel shows the node's real ID so you can reference its output in another node via `{that-id_output}`. Save, Run, or use **Generate with AI** to create a whole workflow from a plain-English instruction, and **Suggest next** to get AI-suggested next nodes for the graph you're building. Keyboard shortcuts: Ctrl/Cmd+S save, Ctrl/Cmd+Enter run, Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z undo/redo. **Versions** panel shows paginated history with a two-version **diff** view and one-click restore. Workflows also expose a public **webhook URL** for external triggering and support **cron scheduling** (set via API for now, see API.md).

### Forms
Fields: text, number, email, select, checkbox, file (upload UI only — not yet wired to real file storage). Conditional visibility (showIf) and **repeatable fields** ("+ Add another") are both supported.

### Rules
Nested AND/OR condition trees, evaluated against arbitrary JSON — including **nested field paths** (e.g. candidate.experience, not just top-level keys). Actions (NOTIFY / TRIGGER_WORKFLOW) are wired into real form-submission flow, not just the test panel.

### Analytics
Real data: run counts, success rate, avg duration, daily execution chart, node-usage breakdown, most-active users.

### Files
Upload/download/share (time-limited public links)/delete, versioned by re-upload.

### API Keys
Issue/revoke keys with per-key rate limiting (60 req/min). Authenticate external calls via X-API-Key against /api/v1/public/workflows*.

### Feature Flags
Global / percentage-rollout / per-org targeting. **Actually gates real behavior** — e.g. disabling ai_node_enabled genuinely blocks AI-node workflow runs for that org, it's not decorative.

### Audit Log, Members, Settings
Standard — role changes, invites (link shown in-app, no email delivery — see TRADEOFFS.md), org rename.

### Theme
Real dark/light toggle (top bar) — not just a fixed dark theme; colors are CSS custom properties, not hardcoded.

---

## Local development

```bash
git clone <this-repo>
cd project-atlas
pnpm install

docker compose up -d   # local Postgres + RabbitMQ

cd packages/database && npx prisma migrate dev && npx prisma generate && npx tsc
cd apps/backend && pnpm dev   # terminal 1
cd apps/worker && pnpm dev    # terminal 2
cd apps/frontend && pnpm dev  # terminal 3
```
Visit http://localhost:5173. See DEPLOYMENT.md for the full environment variable list — note that **local and production use separate RabbitMQ queue names** (workflow-executions-dev vs workflow-executions) so a running deployed worker never intercepts local test traffic.

## CI/CD

Every push to main runs type-checking, linting (zero-warning enforced, not bypassed), unit + integration tests, and a production build across backend/worker/frontend via GitHub Actions.

## Testing

Unit tests: rule evaluator (including nested-path resolution), JWT/refresh-token rotation and reuse detection, graph executor (parallel branches, skip-on-failure, conditional branching). Integration tests: cross-tenant access denial, CSRF regression, refresh-token-family revocation. One Playwright e2e test covers the core login→build→run journey. See **docs/FINAL_SMOKE_TEST.md** for the full manual regression script covering every feature, run before any deployment.

## Honest known gaps

Prometheus/Grafana metrics, email-based invitation delivery, notification free-text @mention parsing (mentions are supported via structured rule-action config, not @name text parsing), form file-upload fields not wired to real storage, cron scheduler is in-process (a backend restart can miss a run due exactly during the restart window, not queued for later). Full list with reasoning: **docs/TRADEOFFS.md**.
