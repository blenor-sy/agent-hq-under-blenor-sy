# Codex continuation brief

You are continuing the Agent HQ project.

## Preserve these principles

1. Never fake agent progress.
2. Agent state comes from signed/reported events.
3. The dashboard must be cross-device and responsive.
4. Agent processes may run independently of the dashboard.
5. Missing heartbeat means stale/offline.
6. Secrets stay server-side.
7. Prefer durable task/event history over ephemeral UI state.

## Next implementation milestones

### P0
- Add Supabase Auth.
- Add owner/workspace model.
- Replace public dashboard RLS with owner-only policies.
- Add dashboard task detail page.
- Add logs with filtering.
- Add per-agent page.

### P1
- Add bidirectional command queue.
- Assign tasks from HQ to agents.
- Add cancel/retry/pause commands.
- Add worker lease/ack mechanism.
- Add task priority.
- Add cron/schedules.

### P2
- Runtime metrics: elapsed, queue time, token usage, cost.
- Files/artifacts table.
- Agent configuration/version history.
- Notifications for failures/offline agents.
- Search across logs and tasks.
- Mobile PWA.

### P3
- Multi-agent orchestration / dependencies.
- Agent-to-agent messages.
- Shared project workspaces.
- Human approval gates.
- Audit logs.
