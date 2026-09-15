create or replace function public.ingest_agent_event(
  requested_agent_id uuid,
  requested_event_id text,
  requested_type text,
  requested_occurred_at timestamptz,
  requested_task_external_id text default null,
  requested_title text default null,
  requested_message text default null,
  requested_progress numeric default null,
  requested_error text default null,
  requested_level text default 'info',
  requested_payload jsonb default '{}'::jsonb,
  requested_artifact jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_agent public.agents;
  selected_task public.tasks;
  inserted_event_id uuid;
  effective_time timestamptz := coalesce(requested_occurred_at, now());
  next_status text;
begin
  if requested_type not in (
    'agent_registered','online','offline','task_queued','task_claimed','task_acknowledged',
    'task_started','progress','current_step','heartbeat','log','artifact_produced',
    'task_completed','task_failed','task_cancelled','idle'
  ) then
    raise exception 'unsupported event type';
  end if;
  if requested_progress is not null and (requested_progress < 0 or requested_progress > 100) then
    raise exception 'progress must be between 0 and 100';
  end if;
  if effective_time > now() + interval '5 minutes' then
    raise exception 'event timestamp is too far in the future';
  end if;

  select * into selected_agent from public.agents
  where id = requested_agent_id and deleted_at is null;
  if selected_agent.id is null then raise exception 'agent not found'; end if;

  if exists (
    select 1 from public.agent_events
    where agent_id = requested_agent_id and event_id = requested_event_id
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if requested_task_external_id is not null then
    if requested_type = 'task_started' then
      insert into public.tasks(
        workspace_id, agent_id, external_id, title, status, progress,
        current_step, started_at, last_event_at, queued_at, updated_at
      ) values (
        selected_agent.workspace_id, selected_agent.id, requested_task_external_id,
        coalesce(requested_title, 'Untitled task'), 'running', requested_progress,
        requested_message, effective_time, effective_time, effective_time, now()
      )
      on conflict (agent_id, external_id) where external_id is not null do nothing;
    end if;

    select * into selected_task from public.tasks
    where agent_id = requested_agent_id and external_id = requested_task_external_id;

    if selected_task.id is null and requested_type in (
      'task_started','progress','current_step','artifact_produced','task_completed',
      'task_failed','task_cancelled'
    ) then
      raise exception 'task not found for event';
    end if;
  end if;

  insert into public.agent_events(
    workspace_id, agent_id, task_id, event_id, type, message, level,
    payload, occurred_at, created_at
  ) values (
    selected_agent.workspace_id, selected_agent.id, selected_task.id,
    requested_event_id, requested_type, requested_message, requested_level,
    requested_payload, effective_time, now()
  )
  on conflict (agent_id, event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if selected_task.id is not null
     and effective_time >= coalesce(selected_task.last_event_at, '-infinity'::timestamptz)
     and selected_task.status not in ('completed','failed','cancelled') then
    if requested_type in ('progress','current_step','heartbeat','log') then
      update public.tasks
      set progress = case when requested_progress is null then progress else requested_progress::integer end,
          current_step = case when requested_message is null then current_step else requested_message end,
          last_event_at = effective_time,
          lease_expires_at = case
            when lease_id is not null then greatest(coalesce(lease_expires_at, now()), now() + interval '60 seconds')
            else null end,
          updated_at = now()
      where id = selected_task.id;
    elsif requested_type = 'task_started' then
      update public.tasks
      set status = 'running',
          title = coalesce(requested_title, title),
          progress = coalesce(requested_progress::integer, progress),
          current_step = coalesce(requested_message, current_step),
          started_at = coalesce(started_at, effective_time),
          last_event_at = effective_time,
          updated_at = now()
      where id = selected_task.id;
    elsif requested_type = 'task_completed' then
      update public.tasks
      set status = 'completed', progress = coalesce(requested_progress::integer, progress),
          current_step = coalesce(requested_message, current_step),
          finished_at = effective_time, last_event_at = effective_time,
          lease_expires_at = null, lease_owner_id = null, lease_id = null, updated_at = now()
      where id = selected_task.id;
      update public.task_attempts set status = 'completed', finished_at = effective_time, updated_at = now()
      where task_id = selected_task.id and status in ('claimed','running');
    elsif requested_type = 'task_failed' then
      update public.tasks
      set status = 'failed', current_step = coalesce(requested_message, current_step),
          error_message = coalesce(requested_error, requested_message, 'Unknown error'),
          finished_at = effective_time, last_event_at = effective_time,
          lease_expires_at = null, lease_owner_id = null, lease_id = null, updated_at = now()
      where id = selected_task.id;
      update public.task_attempts
      set status = 'failed', error_message = coalesce(requested_error, requested_message, 'Unknown error'),
          finished_at = effective_time, updated_at = now()
      where task_id = selected_task.id and status in ('claimed','running');
    elsif requested_type = 'task_cancelled' then
      update public.tasks
      set status = 'cancelled', current_step = coalesce(requested_message, 'Cancelled'),
          finished_at = effective_time, last_event_at = effective_time,
          lease_expires_at = null, lease_owner_id = null, lease_id = null, updated_at = now()
      where id = selected_task.id;
      update public.task_attempts set status = 'cancelled', finished_at = effective_time, updated_at = now()
      where task_id = selected_task.id and status in ('claimed','running');
    end if;
  end if;

  if requested_type = 'artifact_produced' and requested_artifact is not null then
    insert into public.artifacts(
      workspace_id, agent_id, task_id, name, kind, url, storage_path,
      mime_type, size_bytes, checksum, metadata
    ) values (
      selected_agent.workspace_id, selected_agent.id, selected_task.id,
      requested_artifact->>'name', coalesce(requested_artifact->>'kind', 'file'),
      requested_artifact->>'url', requested_artifact->>'storagePath',
      requested_artifact->>'mimeType', nullif(requested_artifact->>'sizeBytes', '')::bigint,
      requested_artifact->>'checksum', coalesce(requested_artifact->'metadata', '{}'::jsonb)
    );
  end if;

  next_status := case
    when requested_type = 'offline' then 'offline'
    when requested_type = 'task_failed' then 'error'
    when requested_type in ('task_started','progress','current_step','log','artifact_produced') then 'working'
    when requested_type in ('idle','task_completed','task_cancelled') then 'idle'
    when requested_type = 'heartbeat' and selected_task.id is not null then 'working'
    else selected_agent.status
  end;

  update public.agents
  set status = next_status,
      runtime_version = coalesce(requested_payload->>'runtimeVersion', runtime_version),
      last_seen_at = greatest(coalesce(last_seen_at, effective_time), effective_time),
      updated_at = now()
  where id = selected_agent.id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'eventId', inserted_event_id,
    'taskId', selected_task.id,
    'receivedAt', now()
  );
end;
$$;

revoke all on function public.ingest_agent_event(
  uuid, text, text, timestamptz, text, text, text, numeric, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_agent_event(
  uuid, text, text, timestamptz, text, text, text, numeric, text, text, jsonb, jsonb
) to service_role;
