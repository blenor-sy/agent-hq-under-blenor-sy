# Codex continuation brief

## Current implementation

Agent HQ 1.0 contains the authenticated dashboard, workspace RLS schema, v1 agent API, idempotent event ingest, durable leased queue, attempts, commands, schedules, notifications, artifacts, usage fields, SDK, and persistent webhook worker.

Before changing behavior, read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/ACCEPTANCE_CRITERIA.md`.

## Mandatory checks

```bash
npm ci
npm run check
supabase db reset
supabase test db
```

Do not report database tests as passed unless a local or isolated remote Supabase database actually ran them.

## Preserve

- Never replace nullable progress with guessed values.
- Never put `SUPABASE_SECRET_KEY`, `CRON_SECRET`, or agent tokens in client code.
- User writes go through authenticated RPCs with membership checks.
- Agent writes go through token-authenticated server routes and service-only RPCs.
- Realtime is a refresh signal, not source of truth.
- A retry creates another `task_attempts` row.
- Pause controls appear only for an agent that declares the `pause` capability.

## External activation still needed

The production Vercel Hobby deployment is live at `https://agent-hq-under-blenor-sy.vercel.app`. The owner must still add `SUPABASE_SECRET_KEY` directly to Vercel without exposing it in chat, configure the production Site URL and `/auth/callback` redirect in Supabase Auth, enable Vercel 2FA, create the owner account, and deploy a compatible persistent worker. A temporary ChatGPT/Codex skill cannot honestly be described as always-on.
