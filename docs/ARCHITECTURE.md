# Architecture

## Goal

Agent HQ is a control plane for multiple independent agents.

The dashboard must display **real reported state**, not simulated percentages.

## Components

### Dashboard
Next.js UI available from phone, tablet, and desktop.

### Supabase
Persistent source of truth for agents, tasks, events, and heartbeats.

### Agent ingest API
Agents authenticate with per-agent tokens and send state changes.

### Agent runtime
Each agent may run in a different environment, including Codex, a server, a home computer, a cloud container, or a scheduled automation.

Agent HQ does not keep those processes alive. It observes and controls them.

## Agent lifecycle

1. Register agent.
2. Store returned agent token in the agent runtime.
3. Start a task.
4. Send heartbeat every 15–60 seconds.
5. Send progress/log updates.
6. Complete or fail task.
7. HQ calculates elapsed time from `started_at`.

## Offline detection

A dashboard agent is considered stale/offline after 90 seconds without a heartbeat.

Later this should move to a server-side health monitor so alerting also works when nobody has the dashboard open.

## Future control-plane additions

- task command queue
- worker polling or WebSocket subscription
- signed command acknowledgements
- cancellation support
- retry policy
- leases to prevent duplicate execution
- scheduled jobs
- priority queues
- per-agent concurrency settings

## Security

Before storing sensitive agent logs:
- Add Supabase Auth.
- Add `owner_id` to all rows.
- Replace public read policies with owner-only policies.
- Keep `SUPABASE_SECRET_KEY` server-only.
- Never put agent tokens in browser code.
