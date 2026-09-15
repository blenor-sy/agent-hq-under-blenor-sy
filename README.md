# Agent HQ

Agent HQ is a secure, cross-device control room for independent AI agent runtimes. It stores real heartbeats, tasks, attempts, logs, artifacts, worker health, schedules, and commands in Supabase Postgres. It never invents activity or progress.

## Product status

The repository contains the complete production architecture and UI. A Supabase project and a web deployment are still required before real agents can connect. Custom ChatGPT/Codex sessions are not permanent workers; see [Known limitations](docs/LIMITATIONS.md).

## Included

- Supabase email/password and passwordless authentication with SSR cookies
- Workspace ownership and database-enforced Row Level Security
- Per-agent, one-time, hashed, revocable credentials
- Versioned `/api/v1` integration contract and retrying TypeScript SDK
- Idempotent telemetry and delayed-event protection
- Truthful live/stale/offline health derived from heartbeats
- Durable priority queue with atomic claims, leases, acknowledgements, attempts, cancellation, and retries
- Recurring interval schedules processed independently of the open dashboard
- Persistent webhook worker adapter with crash recovery and cancellation acknowledgement
- Responsive dashboard for phone, tablet, and desktop
- Agent/task detail pages, timelines, log filters, artifacts, notifications, usage metrics, and audit history
- Database-backed per-credential rate limiting
- CI, unit tests, database integration tests, health endpoint, and operational documentation

## Requirements

- Node.js 22 or newer
- npm 11 or newer
- A dedicated Supabase project
- Supabase CLI for local database testing and migration deployment

## Local setup

```bash
npm ci
cp .env.example .env.local
supabase start
supabase db reset
npm run dev
```

Copy the local Supabase URL, publishable key, and secret/service key into `.env.local`. Generate `CRON_SECRET` with at least 32 random bytes. Never prefix a secret with `NEXT_PUBLIC_`.

Open [http://localhost:3000](http://localhost:3000), create an account, and register an agent from **Agents → Connect agent**. The database trigger creates a private personal workspace for every new authenticated user.

## Quality gate

```bash
npm run check
supabase test db
```

`npm run check` runs formatting, ESLint, TypeScript, unit tests, and the production build. Database tests require a running local Supabase stack.

## Deploy

Migration `0008` configures the minute-by-minute health, lease, and schedule sweep inside Supabase Postgres, so it does not depend on a paid hosting cron or an open browser. Follow [Deployment](docs/DEPLOYMENT.md) to configure Supabase Auth callbacks, protected environment variables, and HTTPS.

## Connect an agent

Use the reusable [TypeScript SDK](sdk/agent-hq-client.ts) or the HTTP API documented in [Agent integration](docs/AGENT_INTEGRATION.md). The School Assistant and Spanish Assistant adapter plan is in [Agent adapters](docs/AGENT_ADAPTERS.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Agent integration](docs/AGENT_INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Operations and backups](docs/OPERATIONS.md)
- [Testing](docs/TESTING.md)
- [Completion report](docs/COMPLETION_REPORT.md)
- [Known limitations](docs/LIMITATIONS.md)
