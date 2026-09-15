alter table public.tasks add column if not exists input_tokens bigint check (input_tokens is null or input_tokens >= 0);
alter table public.tasks add column if not exists output_tokens bigint check (output_tokens is null or output_tokens >= 0);
alter table public.tasks add column if not exists api_requests integer check (api_requests is null or api_requests >= 0);
alter table public.tasks add column if not exists estimated_cost numeric(14, 6) check (estimated_cost is null or estimated_cost >= 0);
alter table public.tasks add column if not exists cost_currency text;

alter table public.task_attempts drop constraint if exists task_attempts_status_check;
alter table public.task_attempts add constraint task_attempts_status_check
  check (status in ('claimed','running','paused','completed','failed','cancelled','lease_expired'));

alter table public.schedules add column if not exists interval_seconds integer;
alter table public.schedules add constraint schedules_interval_check
  check (interval_seconds is null or interval_seconds between 300 and 31536000);

create table if not exists public.api_rate_limits (
  key_hash text not null,
  bucket text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, bucket)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;

create or replace function public.check_api_rate_limit(
  requested_key_hash text,
  requested_bucket text,
  requested_limit integer,
  requested_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if requested_limit < 1 or requested_limit > 10000 or requested_window_seconds < 1 or requested_window_seconds > 3600 then
    raise exception 'invalid rate limit configuration';
  end if;
  insert into public.api_rate_limits(key_hash, bucket, window_started_at, request_count)
  values (requested_key_hash, requested_bucket, now(), 1)
  on conflict (key_hash, bucket) do update
  set window_started_at = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => requested_window_seconds)
        then now() else public.api_rate_limits.window_started_at end,
      request_count = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => requested_window_seconds)
        then 1 else public.api_rate_limits.request_count + 1 end
  returning request_count <= requested_limit into allowed;
  return allowed;
end;
$$;
revoke all on function public.check_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text, text, integer, integer) to service_role;

create or replace function private.process_agent_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id is not null and new.payload ? 'usage' then
    update public.tasks set
      input_tokens = case when jsonb_typeof(new.payload->'usage'->'inputTokens') = 'number' then greatest(0, (new.payload->'usage'->>'inputTokens')::bigint) else input_tokens end,
      output_tokens = case when jsonb_typeof(new.payload->'usage'->'outputTokens') = 'number' then greatest(0, (new.payload->'usage'->>'outputTokens')::bigint) else output_tokens end,
      api_requests = case when jsonb_typeof(new.payload->'usage'->'apiRequests') = 'number' then greatest(0, (new.payload->'usage'->>'apiRequests')::integer) else api_requests end,
      estimated_cost = case when jsonb_typeof(new.payload->'usage'->'estimatedCost') = 'number' then greatest(0, (new.payload->'usage'->>'estimatedCost')::numeric) else estimated_cost end,
      cost_currency = case when jsonb_typeof(new.payload->'usage'->'currency') = 'string' then left(new.payload->'usage'->>'currency', 8) else cost_currency end,
      updated_at = now()
    where id = new.task_id;
  end if;

  if new.type in ('task_failed', 'offline') then
    insert into public.notifications(workspace_id, kind, title, message, entity_type, entity_id)
    values (
      new.workspace_id,
      new.type,
      case when new.type = 'task_failed' then 'Task failed' else 'Agent offline' end,
      new.message,
      case when new.task_id is null then 'agent' else 'task' end,
      coalesce(new.task_id, new.agent_id)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.process_agent_event() from public, anon, authenticated;
drop trigger if exists process_agent_event_trigger on public.agent_events;
create trigger process_agent_event_trigger
  after insert on public.agent_events
  for each row execute function private.process_agent_event();

create or replace function public.enqueue_due_schedules()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_row public.schedules;
  created_task_id uuid;
  queued_count integer := 0;
begin
  for schedule_row in
    select * from public.schedules
    where enabled and interval_seconds is not null and next_run_at <= now()
    order by next_run_at
    for update skip locked
  loop
    insert into public.tasks(
      workspace_id, agent_id, title, description, priority, max_attempts, input,
      status, queued_at
    ) values (
      schedule_row.workspace_id,
      schedule_row.agent_id,
      coalesce(schedule_row.task_template->>'title', schedule_row.name),
      schedule_row.task_template->>'description',
      coalesce((schedule_row.task_template->>'priority')::integer, 0),
      coalesce((schedule_row.task_template->>'maxAttempts')::integer, 3),
      coalesce(schedule_row.task_template->'input', '{}'::jsonb),
      'queued', now()
    ) returning id into created_task_id;
    insert into public.agent_events(
      workspace_id, agent_id, task_id, event_id, type, message, payload, occurred_at
    ) values (
      schedule_row.workspace_id, schedule_row.agent_id, created_task_id,
      'schedule-' || schedule_row.id::text || '-' || created_task_id::text,
      'task_queued', schedule_row.name,
      jsonb_build_object('source', 'schedule', 'scheduleId', schedule_row.id), now()
    );
    update public.schedules set last_run_at = now(),
      next_run_at = greatest(next_run_at, now()) + make_interval(secs => interval_seconds),
      updated_at = now()
    where id = schedule_row.id;
    queued_count := queued_count + 1;
  end loop;
  return queued_count;
end;
$$;
revoke all on function public.enqueue_due_schedules() from public, anon, authenticated;
grant execute on function public.enqueue_due_schedules() to service_role;

create or replace function public.mark_stale_agents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  with offline_agents as (
    update public.agents
    set status = 'offline', updated_at = now()
    where deleted_at is null and status <> 'offline'
      and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
    returning id, workspace_id, name
  ), inserted_notifications as (
    insert into public.notifications(workspace_id, kind, title, message, entity_type, entity_id)
    select workspace_id, 'offline', 'Agent offline', name || ' stopped sending heartbeats.', 'agent', id
    from offline_agents
  )
  select count(*) into changed from offline_agents;

  update public.workers set status = 'offline', updated_at = now()
  where status <> 'offline' and last_heartbeat_at < now() - interval '5 minutes';
  delete from public.api_rate_limits where window_started_at < now() - interval '2 hours';
  return changed;
end;
$$;
revoke all on function public.mark_stale_agents() from public, anon, authenticated;
grant execute on function public.mark_stale_agents() to service_role;

create or replace function public.create_interval_schedule(
  requested_workspace_id uuid,
  requested_agent_id uuid,
  requested_name text,
  requested_interval_seconds integer,
  requested_next_run_at timestamptz,
  requested_task_template jsonb
)
returns public.schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_schedule public.schedules;
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1 from public.workspace_members wm where wm.workspace_id = requested_workspace_id
      and wm.user_id = caller_id and wm.role in ('owner','admin','member')
  ) then raise exception 'not authorized for workspace'; end if;
  if requested_interval_seconds < 300 or requested_interval_seconds > 31536000 then
    raise exception 'interval must be between five minutes and one year';
  end if;
  if not exists (
    select 1 from public.agents where id = requested_agent_id
      and workspace_id = requested_workspace_id and deleted_at is null
  ) then raise exception 'agent not found in workspace'; end if;
  insert into public.schedules(
    workspace_id, agent_id, name, cron_expression, timezone, task_template,
    interval_seconds, next_run_at, enabled
  ) values (
    requested_workspace_id, requested_agent_id, requested_name,
    '@every ' || requested_interval_seconds::text || 's', 'UTC', requested_task_template,
    requested_interval_seconds, requested_next_run_at, true
  ) returning * into created_schedule;
  return created_schedule;
end;
$$;
revoke all on function public.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  from public, anon;
grant execute on function public.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  to authenticated;
