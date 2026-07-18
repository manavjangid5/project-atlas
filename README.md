# Project Atlas

**AI-powered collaborative workflow automation platform** — a self-hosted alternative to Zapier/n8n with a first-class AI node, built as a multi-tenant SaaS with organizations, roles, dynamic forms, a rules engine, and full observability.

🔗 **Live app:** [https://project-atlas-frontend.onrender.com](https://project-atlas-frontend.onrender.com) *(replace with real URL)*
🔗 **Live API:** [https://project-atlas-vupz.onrender.com/api/v1/health](https://project-atlas-vupz.onrender.com/api/v1/health) *(replace with real URL)*

---

## What is this?

Modern teams glue together Slack, GitHub, forms, spreadsheets, and AI tools
by hand. Project Atlas lets an organization visually design an automation —
*"every morning, summarize yesterday's activity with AI and post it to
Slack"* — on a drag-and-drop canvas, run it reliably with retries and full
logs, and manage everything (members, forms, rules, files) inside one
multi-tenant workspace.

For the full technical breakdown of how it's built, read
**[docs/ARCHITECTURE.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/ARCHITECTURE.md)**.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Zustand, Tailwind CSS, React Flow, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma |
| Database | PostgreSQL |
| Message Queue | RabbitMQ |
| Auth | JWT (rotation + reuse detection), Google & GitHub OAuth |
| AI | Google Gemini |
| Storage | Cloudflare R2 (S3-compatible) |
| Real-time | Socket.io |
| Deployment | Render (frontend static site, backend + worker web services), GitHub Actions CI |

Full endpoint list: **[docs/API.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/API.md)**
Full database schema: **[docs/DATABASE_ERD.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/DATABASE_ERD.md)**
Deployment steps: **[docs/DEPLOYMENT.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/DEPLOYMENT.md)**
Design decisions & known limitations: **[docs/TRADEOFFS.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/TRADEOFFS.md)**
What's next: **[docs/SCALABILITY_AND_FUTURE_WORK.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/SCALABILITY_AND_FUTURE_WORK.md)**

---

## Getting started (as a user)

1. **Register** an account (email/password, or continue with Google/GitHub).
2. On first login you'll be asked to **create an organization** — you
   automatically become its **Owner**.
3. You land on the dashboard. The sidebar is your home base — here's what
   every tab actually does:

### Workflows
The core of the app. A visual, drag-and-drop canvas (like n8n or Zapier)
where you build automations out of nodes — HTTP Request, Delay, Conditional,
Slack, AI Prompt, Webhook. Connect nodes with edges to define execution
order, click a node to configure it, hit **Save**, then **Run**. A live
**Run History** panel shows every execution with per-node logs, retries, and
final status. Runs execute asynchronously on a separate worker process, so
triggering one never blocks the app. Details: [docs/ARCHITECTURE.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/ARCHITECTURE.md).

### Forms
A dynamic form builder — add fields (text, number, email, select, checkbox,
file), mark fields required, and set conditional visibility ("only show this
field if that checkbox is checked"). A live preview updates as you build.
Useful for collecting structured input that can later feed into workflows or
rules.

### Rules
A visual, nested **IF/ELSE rule engine** — build AND/OR condition trees
against arbitrary data (e.g. *"if location equals India AND experience is
greater than 5"*), attach an action (notify, or trigger a workflow), and test
it live against sample JSON before relying on it. Entirely data-driven — no
hardcoded logic.

### Analytics
A read-only dashboard: total workflow runs, success rate, average execution
duration, a 14-day chart of daily executions, a breakdown of which node types
you use most, and your organization's most active members. Everything here
is computed from real execution/audit data — nothing is mocked.

### Files
Upload, download, and share files (images, PDFs, text, JSON, CSV — 20MB
cap). Every re-upload against an existing file creates a new version.
**Share** generates a time-limited public link anyone can open without
logging in — useful for sending a file to someone outside your organization.

### API Keys
Generate keys for programmatic/external access to your organization's data
(the raw key is shown exactly once, like Stripe or GitHub tokens). Also
shows request-usage stats so you can see how actively a key is being used.

### Feature Flags
Turn platform features on/off — either globally, for specific organizations,
or via a percentage-based gradual rollout slider. Meant for controlled
rollout of new capabilities without shipping a new deploy for every toggle.

### Audit Log
A timeline of every meaningful action taken in your organization — logins,
workflow edits and runs, role changes. Exists for accountability and
debugging ("who changed what, and when").

### Members
See everyone in your organization and their role (Owner/Admin/Developer/
Viewer). Owners and Admins can invite new members by email, change roles, or
remove people. Roles are enforced on the backend, not just hidden in the UI —
a Viewer genuinely cannot perform Admin actions even by calling the API
directly.

### Settings
Organization-level configuration — currently the organization's display
name (Owner-only). The natural home for future org-wide preferences.

---

## Local development

```bash
git clone <this-repo>
cd project-atlas
pnpm install

# apps/backend/.env, apps/worker/.env, apps/frontend/.env — see
# docs/DEPLOYMENT.md for the full list of required environment variables

docker compose up -d          # local Postgres

cd apps/backend && npx prisma migrate dev && pnpm dev   # terminal 1
cd apps/worker && pnpm dev                                # terminal 2
cd apps/frontend && pnpm dev                               # terminal 3
```

Visit `http://localhost:5173`.

## CI/CD

Every push to `main` runs type-checking, unit tests, and a production build
across all three packages via GitHub Actions (`.github/workflows/ci.yml`).

## Testing

Unit tests (Jest) cover the rule engine, JWT/token utilities, and the
workflow graph executor. An end-to-end test (Playwright) covers the full
login → build workflow → run → verify result journey. See
[docs/TRADEOFFS.md](https://github.com/manavjangid5/project-atlas/blob/main/docs/TRADEOFFS.md) for the reasoning behind this test scope.
