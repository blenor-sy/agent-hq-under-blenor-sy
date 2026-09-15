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

- Next.js 16.3.4
- React 19.3.0
- TypeScript
- Supabase JS 2.116.0
- Supabase Postgres + Realtime

## Start here

1. Read `README.md`.
2. Read `docs/ARCHITECTURE.md`.
3. Read `docs/CODEX_NEXT.md`.
4. Inspect `supabase/migrations/0001_agent_hq.sql`.
5. Run the app and preserve existing API contracts unless intentionally versioning them.

## Definition of done for new monitoring features

A monitoring feature is only complete if:
- data is persisted,
- dashboard rendering is based on actual data,
- failure/offline cases are handled,
- mobile layout is considered,
- secrets remain protected.
