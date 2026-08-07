# Project Atlas

**AI-powered collaborative workflow automation platform** — a self-hosted alternative to Zapier/n8n with AI as a first-class node type (including natural-language workflow generation), built as a multi-tenant SaaS with dynamic permissions, dynamic forms, and a rules engine.

Observability is structured request logging (morgan), per-node execution logs, a `/health` endpoint that checks DB and queue connectivity, and a real `GET /metrics` endpoint (Prometheus format, via `prom-client` — HTTP request counts/duration, workflow run counts by status). There is no Grafana dashboard built against these metrics — the scrape endpoint itself is real, visualization is not (see TRADEOFFS.md).

🔗 **Live app:** https://project-atlas-frontend.onrender.com
🔗 **Live API:** https://project-atlas-vupz.onrender.com/api/v1/health
🔗 **API docs (Swagger):** https://project-atlas-vupz.onrender.com/api/docs/

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
Fields: text, number, email, select, checkbox, file (genuinely uploads to R2 on submission, same storage backend as the standalone Files module). Conditional visibility (showIf) and **repeatable fields** ("+ Add another") are both supported.

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
See DEPLOYMENT.md for the full environment variable list — note that **local and production use separate RabbitMQ queue names** (workflow-executions-dev vs workflow-executions) so a running deployed worker never intercepts local test traffic.

## CI/CD

Every push to main runs type-checking, linting (zero-warning enforced, not bypassed), unit + integration tests, and a production build across backend/worker/frontend via GitHub Actions.

## Testing

Unit tests: rule evaluator (nested-path resolution, empty-group vacuous-truth guard, full nested AND/OR trees against realistic data), JWT/refresh-token rotation and reuse detection, graph executor (parallel branches, skip-on-failure, and correctly distinguishing a legitimately-skipped conditional branch from a genuine upstream failure), the dynamic permission model's override-vs-default-matrix fallback, the SSRF guard's actual IP/protocol blocklist, global search's result composition, and form submission's real R2 file-upload path. Integration tests: cross-tenant access denial, CSRF regression, refresh-token-family revocation. One Playwright e2e test covers the core login→build→run journey. Several of the above tests exist specifically because manual testing found real bugs with zero prior automated coverage — see TRADEOFFS.md for the full list of what was found and fixed. The complete manual regression script, **docs/TESTING_GUIDE.md**, has been run and confirmed against both the local environment and the deployed production URL — see **docs/DEPLOYMENT.md**'s "Verification status" section for the precise, itemized breakdown.

## Honest known gaps

A Grafana dashboard (the `/metrics` scrape endpoint itself is real, but nothing visualizes it), email-based invitation delivery, notification free-text @mention parsing (mentions are supported via structured rule-action config, not @name text parsing), cron scheduler is in-process (a backend restart can miss a run due exactly during the restart window, not queued for later), no automated production migration/queue-sync step in the deploy pipeline (a manual step, which caused two real incidents during final verification — see TRADEOFFS.md), and **login does not work in Incognito/Private browsing** on the deployed environment specifically — a structural consequence of the frontend and backend being on separate Render subdomains (auth cookies are third-party from the browser's perspective, and Incognito blocks those by default). Regular browser sessions are unaffected; full explanation in TRADEOFFS.md. Full list with reasoning: **docs/TRADEOFFS.md**.
