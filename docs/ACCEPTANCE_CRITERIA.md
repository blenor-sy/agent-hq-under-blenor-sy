# Agent HQ — Acceptance Criteria

This file defines what “working” means. A feature is not considered complete just because the UI exists.

## Global release criteria

A production release must satisfy all of these:

- Production build completes successfully.
- Critical user flows have automated or repeatable tests.
- No secret keys or agent credentials are shipped to browser code.
- Private data is protected by authentication and authorization.
- No fake/random progress is shown as real agent progress.
- Offline and stale states are visible and correct.
- Refreshing the page does not lose task history.
- The same account sees the same state across devices.
- Error states are understandable and do not silently fail.
- Database schema is reproducible from migrations.
- Backup and restore procedure is documented before meaningful private data is trusted to the system.

## Authentication

- Unauthenticated visitor cannot see private dashboard data.
- User can sign in and sign out.
- Expired sessions are handled cleanly.
- Authorization is enforced in the database, not only in UI code.

## Agent identity

- Every agent has a stable unique ID.
- Every agent uses its own credential/token.
- One agent cannot report events as another agent.
- Agent tokens are stored hashed where appropriate and can be revoked.
- Revoked agent credentials stop working.

## Agent state

Supported display states should eventually include:

- online/idle
- working
- paused (when supported)
- error
- stale
- offline

Rules:

- Working state must correspond to a real active task/event.
- Offline/stale must be determined by heartbeat timing, not by UI assumptions.
- A completed task cannot continue counting elapsed runtime.
- A failed task records a failure reason.

## Tasks

- Task has stable ID and owning agent/workspace.
- Task records created, started, updated, and finished timestamps as applicable.
- Running task shows elapsed time derived from timestamps.
- Completed task remains in history.
- Failed task remains in history.
- Repeated network events do not create accidental duplicate tasks.
- Progress is optional; when an agent cannot provide meaningful progress, HQ shows activity without inventing a percentage.

## Logs/events

- Events are timestamped.
- Events identify the agent and task where relevant.
- Logs survive refresh.
- Large log streams are paginated/limited so the dashboard stays responsive.
- Sensitive secrets are never intentionally written into logs.

## Realtime behavior

- New events appear without manual refresh when realtime is available.
- Reconnecting after network loss refreshes canonical state from the database.
- Realtime delivery is treated as a convenience; persisted database state remains the source of truth.

## Cross-device

Verify at minimum:

- phone-sized viewport;
- tablet-sized viewport;
- desktop viewport.

The following must remain usable:

- sign in;
- agent overview;
- task details;
- logs;
- core task controls once implemented.

## Control plane (later phase)

When HQ gains task assignment:

- command is durable before agent acknowledges it;
- only intended agent can claim it;
- task is not executed twice because of retries/polling;
- cancellation has a clear requested/acknowledged state;
- retry creates an auditable attempt;
- agent going offline does not silently discard commands.

## Always-on behavior

- Dashboard availability and worker availability are tracked separately.
- Agent can continue supported background work while user closes the dashboard.
- Missing worker heartbeat is detected without requiring the dashboard to remain open.
- Worker restart strategy is documented.

## Security gate before private use

Before the user puts real private school/work content into Agent HQ:

- Supabase Auth (or equivalent) is enabled;
- public/anonymous read policies are removed;
- owner/workspace authorization is enforced with RLS;
- server secrets are only stored in protected environment variables;
- agent tokens are revocable;
- production logs are reviewed for accidental secret exposure;
- HTTPS is enabled.

## Definition of “Phase complete”

A phase is complete only when:

1. its acceptance criteria pass;
2. known limitations are documented;
3. no critical security regression is introduced;
4. the repo contains the code/config needed to reproduce the result;
5. the next phase does not depend on undocumented manual state.
