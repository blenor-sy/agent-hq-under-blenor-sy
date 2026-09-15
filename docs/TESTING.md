# Testing

## Local application gate

`npm run check` must pass before every release. It covers formatting, lint, strict TypeScript, 19 unit/API-validation assertions, and a production Next.js build.

Unit coverage includes duration/clock-skew behavior, heartbeat thresholds, task transitions, terminal states, credential entropy/hashing, JSON/content-type rejection, bearer validation, optional truthful progress, invalid progress, registration bounds, and task attempt bounds.

## Database integration gate

With local Supabase running:

```bash
supabase db reset
supabase test db
```

`supabase/tests/rls_and_queue.sql` verifies workspace creation, anonymous denial, tenant isolation, priority claiming, two non-duplicated claims, and duplicate-event idempotency. Do not substitute static SQL inspection for executing this test before production.

## Manual release checklist

- 390 px phone, 768 px tablet, and 1440 px desktop widths
- account creation/sign-in/sign-out/expired session
- empty workspace and multiple agents
- live → stale → offline heartbeat transition
- task without percentage and task with reported percentage
- claim/ack/start/heartbeat/complete
- failure, retry, second attempt history
- cancellation requested and worker acknowledgement
- Realtime disconnect/reconnect plus canonical refresh
- artifact link and missing/unsupported metrics
- two devices with the same account and one unauthorized/logged-out browser
