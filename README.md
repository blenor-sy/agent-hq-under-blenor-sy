# Agent HQ

A cross-device control room for all of your agents.

## What it tracks

- Agent online/offline state
- Current task
- Current step
- Progress %
- Started time
- Live elapsed time
- Heartbeats / last seen
- Logs and events
- Completed and failed tasks
- Task history
- Error messages
- Agent metadata and capabilities

## Architecture

- **Dashboard:** Next.js
- **Database/Auth/Realtime:** Supabase
- **Agent reporting:** HTTP ingest API
- **Cross-device:** deploy the Next.js app to a web host
- **Always-on:** agents/workers can run anywhere and send heartbeats to HQ

Agent HQ does not guess what an agent is doing. Agents explicitly report state and progress.

## Local start

1. Install Node.js 22+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a Supabase project.
5. Run `supabase/migrations/0001_agent_hq.sql` in the Supabase SQL editor.
6. Add your Supabase URL / publishable key / secret key.
7. Run `npm run dev`.

Open http://localhost:3000.

## Agent API

Register/update an agent with the admin endpoint:

`POST /api/agents/register`

Header:

`Authorization: Bearer <AGENT_ADMIN_SECRET>`

Body:

```json
{
  "slug": "spanish-assistant",
  "name": "Spanish Assistant",
  "description": "Spanish school assistant",
  "capabilities": ["homework", "translation", "grammar"]
}
```

The response returns an agent token. Store that token securely in the agent's runtime.

Then send agent events:

`POST /api/agents/event`

Header:

`Authorization: Bearer <agent token>`

Examples:

```json
{
  "type": "task_started",
  "taskExternalId": "homework-123",
  "title": "Spanish homework",
  "message": "Starting exercise 4",
  "progress": 0
}
```

```json
{
  "type": "heartbeat",
  "taskExternalId": "homework-123",
  "message": "Writing answer 2",
  "progress": 45
}
```

```json
{
  "type": "task_completed",
  "taskExternalId": "homework-123",
  "message": "Finished",
  "progress": 100
}
```

## Nonstop operation

The dashboard can stay online 24/7 once deployed, but each agent also needs a runtime that stays online (Codex environment, cloud worker, server, computer, etc.). The agent sends heartbeats every 15–60 seconds while working.

A missing heartbeat is what marks an agent as stale/offline.

## Recommended next steps

- Add Supabase Auth so only you can view the HQ.
- Deploy dashboard.
- Connect `$school-assistant`.
- Connect `$spanish-assistant`.
- Add notification rules.
- Add task assignment from HQ back to agents.
- Add agent queue / worker transport.
- Add file/artifact links.
- Add cost/token/runtime metrics.
