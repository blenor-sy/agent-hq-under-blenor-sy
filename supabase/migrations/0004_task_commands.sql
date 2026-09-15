create or replace function public.create_hq_task(
  requested_workspace_id uuid,
  requested_agent_id uuid,
  requested_title text,
  requested_description text default null,
  requested_priority integer default 0,
  requested_scheduled_for timestamptz default null,
  requested_max_attempts integer default 3,
  requested_input jsonb default '{}'::jsonb
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_task public.tasks;
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requested_workspace_id and wm.user_id = caller_id
  ) then raise exception 'not authorized for workspace'; end if;
  if not exists (
    select 1 from public.agents a
    where a.id = requested_agent_id and a.workspace_id = requested_workspace_id and a.deleted_at is null
  ) then raise exception 'agent not found in workspace'; end if;

  insert into public.tasks(
    workspace_id, agent_id, title, description, priority, scheduled_for,
    max_attempts, input, status, queued_at
  ) values (
    requested_workspace_id, requested_agent_id, requested_title, requested_description,
    requested_priority, requested_scheduled_for, requested_max_attempts,
    requested_input, 'queued', now()
  ) returning * into created_task;

  insert into public.agent_events(
    workspace_id, agent_id, task_id, event_id, type, message, payload, occurred_at
  ) values (
    created_task.workspace_id, created_task.agent_id, created_task.id,
    'hq-queued-' || created_task.id::text, 'task_queued', created_task.title,
    jsonb_build_object('source', 'dashboard', 'priority', created_task.priority), now()
  );
  insert into public.command_audit(
    workspace_id, task_id, agent_id, actor_user_id, action, to_status
  ) values (
    created_task.workspace_id, created_task.id, created_task.agent_id, caller_id, 'create', 'queued'
  );
  return created_task;
end;
$$;
revoke all on function public.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  from public, anon;
grant execute on function public.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  to authenticated;

create or replace function public.apply_worker_task_action(
  requested_agent_id uuid,
  requested_worker_id uuid,
  requested_task_id uuid,
  requested_lease_id uuid,
  requested_action text,
  requested_message text default null,
  requested_error text default null,
  requested_progress numeric default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks;
  prior_status text;
begin
  if requested_action not in ('acknowledge','start','heartbeat','paused','complete','fail','cancelled') then
    raise exception 'unsupported task action';
  end if;
  if requested_progress is not null and (requested_progress < 0 or requested_progress > 100) then
    raise exception 'progress must be between 0 and 100';
  end if;
  select * into current_task from public.tasks t
  where t.id = requested_task_id
    and t.agent_id = requested_agent_id
    and t.lease_owner_id = requested_worker_id
    and t.lease_id = requested_lease_id
    and t.lease_expires_at >= now()
  for update;
  if current_task.id is null then raise exception 'active lease not found'; end if;
  prior_status := current_task.status;

  if requested_action = 'acknowledge' then
    if current_task.status <> 'claimed' then raise exception 'task is not claimable for acknowledgement'; end if;
    update public.tasks set acknowledged_at = now(), updated_at = now() where id = current_task.id;
  elsif requested_action = 'start' then
    if current_task.status not in ('claimed','paused') then raise exception 'task cannot be started'; end if;
    update public.tasks set status = 'running', started_at = coalesce(started_at, now()),
      current_step = coalesce(requested_message, current_step),
      lease_expires_at = now() + interval '60 seconds', updated_at = now()
    where id = current_task.id;
    update public.task_attempts set status = 'running', started_at = coalesce(started_at, now()), updated_at = now()
    where lease_id = requested_lease_id;
  elsif requested_action = 'heartbeat' then
    if current_task.status not in ('claimed','running','pause_requested','cancel_requested') then
      raise exception 'task is not active';
    end if;
    update public.tasks set
      progress = coalesce(requested_progress::integer, progress),
      current_step = coalesce(requested_message, current_step),
      lease_expires_at = now() + interval '60 seconds', updated_at = now()
    where id = current_task.id;
  elsif requested_action = 'paused' then
    if current_task.status <> 'pause_requested' then raise exception 'pause was not requested'; end if;
    update public.tasks set status = 'paused', current_step = coalesce(requested_message, 'Paused'),
      lease_id = null, lease_owner_id = null, lease_expires_at = null, updated_at = now()
    where id = current_task.id;
    update public.task_attempts set status = 'paused', finished_at = now(), updated_at = now()
    where lease_id = requested_lease_id;
  elsif requested_action = 'complete' then
    if current_task.status not in ('running','cancel_requested') then raise exception 'task cannot be completed'; end if;
    update public.tasks set status = 'completed', progress = coalesce(requested_progress::integer, progress),
      current_step = coalesce(requested_message, current_step), finished_at = now(),
      lease_id = null, lease_owner_id = null, lease_expires_at = null, updated_at = now()
    where id = current_task.id;
    update public.task_attempts set status = 'completed', finished_at = now(), updated_at = now()
    where lease_id = requested_lease_id;
  elsif requested_action = 'fail' then
    if current_task.status not in ('claimed','running','pause_requested','cancel_requested') then
      raise exception 'task cannot fail from current state';
    end if;
    update public.tasks set status = 'failed', error_message = coalesce(requested_error, requested_message, 'Unknown error'),
      current_step = coalesce(requested_message, current_step), finished_at = now(),
      lease_id = null, lease_owner_id = null, lease_expires_at = null, updated_at = now()
    where id = current_task.id;
    update public.task_attempts set status = 'failed',
      error_message = coalesce(requested_error, requested_message, 'Unknown error'),
      finished_at = now(), updated_at = now()
    where lease_id = requested_lease_id;
  elsif requested_action = 'cancelled' then
    if current_task.status <> 'cancel_requested' then raise exception 'cancellation was not requested'; end if;
    update public.tasks set status = 'cancelled', current_step = coalesce(requested_message, 'Cancelled'),
      finished_at = now(), lease_id = null, lease_owner_id = null, lease_expires_at = null, updated_at = now()
    where id = current_task.id;
    update public.task_attempts set status = 'cancelled', finished_at = now(), updated_at = now()
    where lease_id = requested_lease_id;
  end if;

  update public.workers set last_heartbeat_at = now(), status = case
    when requested_action in ('paused','complete','fail','cancelled') then 'online' else 'busy' end,
    updated_at = now()
  where id = requested_worker_id and agent_id = requested_agent_id;
  update public.agents set last_seen_at = now(), status = case
    when requested_action = 'fail' then 'error'
    when requested_action = 'paused' then 'paused'
    when requested_action in ('complete','cancelled') then 'idle'
    else 'working' end,
    updated_at = now()
  where id = requested_agent_id;

  insert into public.command_audit(
    workspace_id, task_id, agent_id, actor_worker_id, action, from_status, to_status,
    details
  ) select workspace_id, id, agent_id, requested_worker_id, requested_action,
    prior_status, status, jsonb_build_object('leaseId', requested_lease_id)
  from public.tasks where id = current_task.id;
  select * into current_task from public.tasks where id = current_task.id;
  return current_task;
end;
$$;
revoke all on function public.apply_worker_task_action(uuid, uuid, uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.apply_worker_task_action(uuid, uuid, uuid, uuid, text, text, text, numeric)
  to service_role;

create or replace function public.apply_dashboard_task_action(
  requested_task_id uuid,
  requested_action text
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks;
  caller_id uuid := (select auth.uid());
  prior_status text;
begin
  if caller_id is null then raise exception 'authentication required'; end if;
  select * into current_task from public.tasks where id = requested_task_id for update;
  if current_task.id is null or not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = current_task.workspace_id and wm.user_id = caller_id
  ) then raise exception 'task not found'; end if;
  prior_status := current_task.status;

  if requested_action = 'cancel' then
    if current_task.status in ('queued','paused') then
      update public.tasks set status = 'cancelled', cancel_requested_at = now(),
        finished_at = now(), updated_at = now() where id = current_task.id;
    elsif current_task.status in ('claimed','running','pause_requested') then
      update public.tasks set status = 'cancel_requested', cancel_requested_at = now(), updated_at = now()
      where id = current_task.id;
    else raise exception 'task cannot be cancelled'; end if;
  elsif requested_action = 'retry' then
    if current_task.status not in ('failed','cancelled') then raise exception 'only failed or cancelled tasks can be retried'; end if;
    update public.tasks set status = 'queued', error_message = null, finished_at = null,
      queued_at = now(), claimed_at = null, acknowledged_at = null, started_at = null,
      cancel_requested_at = null, lease_id = null, lease_owner_id = null,
      lease_expires_at = null, max_attempts = least(10, greatest(max_attempts, attempt_count + 1)),
      updated_at = now() where id = current_task.id;
  elsif requested_action = 'pause' then
    if current_task.status <> 'running' then raise exception 'only running tasks can be paused'; end if;
    update public.tasks set status = 'pause_requested', updated_at = now() where id = current_task.id;
  elsif requested_action = 'resume' then
    if current_task.status <> 'paused' then raise exception 'only paused tasks can be resumed'; end if;
    update public.tasks set status = 'queued', queued_at = now(), lease_id = null,
      lease_owner_id = null, lease_expires_at = null, updated_at = now()
    where id = current_task.id;
  else raise exception 'unsupported dashboard action'; end if;

  insert into public.command_audit(
    workspace_id, task_id, agent_id, actor_user_id, action, from_status, to_status
  ) select workspace_id, id, agent_id, caller_id, requested_action, prior_status, status
  from public.tasks where id = current_task.id;
  select * into current_task from public.tasks where id = current_task.id;
  return current_task;
end;
$$;
revoke all on function public.apply_dashboard_task_action(uuid, text) from public, anon;
grant execute on function public.apply_dashboard_task_action(uuid, text) to authenticated;
