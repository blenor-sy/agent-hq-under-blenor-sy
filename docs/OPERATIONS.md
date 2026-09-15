# Operations, monitoring, and recovery

## Health

- `/api/health` checks dashboard/API availability and whether public database configuration exists. It does not claim the database or workers are healthy.
- Agent and worker health come from their individual heartbeat timestamps.
- Supabase Cron runs `agent-hq-maintenance` every minute to persist offline agents/workers, release expired leases, queue due schedules, and remove old rate-limit buckets.
- `/api/cron/maintenance` provides an optional authenticated fallback for a host scheduler or manual operational check.
- Failure and offline notifications persist in `notifications`.

Use host uptime monitoring for `/api/health`, Supabase project monitoring for database/Auth/Realtime, and worker-platform health checks for containers. These are distinct signals.

Verify the database scheduler with:

```sql
select jobname, schedule, active, command
from cron.job
where jobname = 'agent-hq-maintenance';
```

## Backup

Enable Supabase automated backups appropriate to the plan. Before storing important private data:

1. Record the project region and backup retention.
2. Export schema/migrations from source control and keep migrations immutable after production use.
3. Create a logical backup before risky releases.
4. Restore into an isolated project or branch.
5. Run migrations, `supabase test db`, and a row-count/integrity comparison.
6. Only then approve a production restore.

Never test restoration by overwriting the only production database.

## Incident handling

- **Agent offline:** verify runtime/container first, then token validity and network access.
- **Repeated task failure:** inspect attempt history and event logs; do not erase earlier attempts.
- **Worker crash:** the lease expires; maintenance requeues while attempts remain.
- **Realtime disconnect:** the UI shows reconnecting and refreshes canonical data on focus/network recovery.
- **Credential exposure:** create a replacement, update the worker secret, verify heartbeat, then revoke the old token.
- **Database request failure:** no optimistic task state is treated as authoritative; retry after service recovery.
