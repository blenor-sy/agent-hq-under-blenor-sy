-- Run health, lease, and schedule maintenance in Postgres so it continues even
-- when the dashboard and hosting functions are idle.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'agent-hq-maintenance') then
    perform cron.schedule(
      'agent-hq-maintenance',
      '* * * * *',
      'select public.mark_stale_agents(), public.release_expired_task_leases(), public.enqueue_due_schedules()'
    );
  end if;
end;
$$;
