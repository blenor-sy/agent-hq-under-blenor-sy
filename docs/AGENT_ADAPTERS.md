# School and Spanish Assistant adapters

## Current platform limitation

The existing School Assistant and Spanish Assistant are custom ChatGPT/Codex experiences, not independent processes with guaranteed outbound HTTP, durable secret storage, or permanent execution. Agent HQ therefore does **not** claim they are connected or always online.

## Supported integration path

For each assistant:

1. Register `school-assistant` or `spanish-assistant` in Agent HQ.
2. Store its one-time token in a persistent runtime secret manager.
3. Deploy the provided webhook worker and an HTTPS handler that invokes the permitted model/API workflow.
4. Have the handler report real step, artifact, and usage data through the SDK.
5. Keep progress absent unless the assignment has a measurable finite unit count.

Recommended capability examples:

| Agent             | Capabilities                                                                      |
| ----------------- | --------------------------------------------------------------------------------- |
| School Assistant  | `homework`, `study-sheets`, `presentations`, `teacher-email`, `deadline-planning` |
| Spanish Assistant | `translation`, `grammar`, `vocabulary`, `homework`, `pronunciation`               |

The webhook handler contract receives `{ taskId, title, description, input, attempt }` and must return JSON. The supplied worker handles claiming, heartbeats, cancellation, success, and failure; it never evaluates task content as local code.

If a future ChatGPT/Codex platform exposes signed runtime webhooks or durable worker APIs, implement a new adapter behind the same Agent HQ v1 contract without changing dashboard records.
