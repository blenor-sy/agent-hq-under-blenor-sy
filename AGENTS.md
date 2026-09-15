# AGENTS.md — Agent HQ

## Mission

Build a reliable, cross-device control room for all of the user's agents.

## Non-negotiable rules

- Never show fake/random progress as real.
- Every live status must come from an agent event, heartbeat, task record, or explicit system state.
- Keep a durable history of tasks and events.
- Keep secrets server-side.
- Never expose `SUPABASE_SECRET_KEY` or agent tokens to browser code.
- Treat an agent as stale/offline when heartbeats stop.
- Keep the UI useful on phone, iPad, and desktop.
- Prefer incremental, testable changes.
- Update `docs/ARCHITECTURE.md` when architecture changes.

## Current stack

- Next.js 16.3.5
- React 19.3.0
- TypeScript
- Supabase JS 2.116.0
- Supabase Postgres + Realtime

## Start here

1. Read `README.md`.
2. Read `docs/ARCHITECTURE.md`.
3. Read `docs/CODEX_NEXT.md`.
4. Inspect every ordered file in `supabase/migrations/` and the database tests.
5. Run `npm run check`; run `supabase db reset && supabase test db` when a local stack is available.
6. Preserve `/api/v1` unless intentionally introducing and documenting a new version.

## Write boundaries

- Browser reads are RLS-scoped to workspace membership.
- Browser commands use authenticated RPCs that verify `auth.uid()`.
- Agent commands use a per-agent bearer token and service-only RPCs.
- Never grant browser roles access to `agent_tokens` or `api_rate_limits`.
- Never mutate a leased task without matching agent, worker, task, lease ID, and expiry.
- Show pause controls only when the agent declares the `pause` capability.

## Definition of done for new monitoring features

A monitoring feature is only complete if:

- data is persisted,
- dashboard rendering is based on actual data,
- failure/offline cases are handled,
- mobile layout is considered,
- secrets remain protected.
