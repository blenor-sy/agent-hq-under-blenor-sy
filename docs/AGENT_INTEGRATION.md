# Agent integration API

## 1. Register

Sign into Agent HQ and choose **Agents → Connect agent**. Save the one-time token in the runtime’s protected secret store. Never paste it into browser code, source control, event logs, or task text.

## 2. Report events

`POST /api/v1/events`

```http
Authorization: Bearer <agent-token>
Content-Type: application/json
```

```json
{
  "eventId": "01J8SCHOOLTASK-START-1",
  "type": "task_started",
  "taskExternalId": "school-2026-09-15-001",
  "title": "Prepare physics study sheet",
  "message": "Reading the assignment",
  "occurredAt": "2026-09-15T18:00:00Z"
}
```

Reuse the same `eventId` for network retries. Do not send a progress field unless the runtime has a real, measurable percentage.

Supported event types: `online`, `offline`, `heartbeat`, `task_started`, `progress`, `current_step`, `log`, `artifact_produced`, `task_completed`, `task_failed`, `task_cancelled`, and `idle`.

An artifact event includes `artifact.name` and either an HTTPS `url` or private `storagePath`. Usage metadata is optional:

```json
{
  "eventId": "01J8SCHOOLTASK-DONE-1",
  "type": "task_completed",
  "taskExternalId": "school-2026-09-15-001",
  "message": "Study sheet finished",
  "metadata": {
    "usage": {
      "inputTokens": 1024,
      "outputTokens": 680,
      "apiRequests": 1,
      "estimatedCost": 0.0123,
      "currency": "USD"
    }
  }
}
```

Only send cost when the runtime can calculate it from real provider/model usage.

## 3. Run a persistent worker

The worker lifecycle is:

1. `POST /api/v1/workers/register`
2. `POST /api/v1/tasks/claim` with `workerId`
3. `PATCH /api/v1/tasks/{taskId}/worker` to acknowledge and start
4. Heartbeat every 15–60 seconds with the matching `leaseId`
5. Complete, fail, acknowledge cancellation, or acknowledge pause

Use `worker/runner.mjs` or `sdk/agent-hq-client.ts`. A claim response of `204 No Content` means there is currently no due task.

## 4. Retry policy

The SDK retries timeouts, 429s, and server failures with exponential backoff. Event retries are safe because their ID does not change. Do not generate a new event ID for the same logical event.

## 5. Add a future agent

No schema change is needed. Register a unique slug, display name, runtime type/version, and capabilities. Declare `pause` only if the worker can safely stop and later restart work; otherwise Agent HQ hides pause controls.
