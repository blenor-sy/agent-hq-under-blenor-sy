-- Keep privileged implementations outside the Data API's exposed public schema.
-- The public wrappers run with the caller's JWT context, so auth.uid() and the
-- workspace membership checks inside each private implementation still apply.

alter function public.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  set schema private;
alter function public.apply_dashboard_task_action(uuid, text)
  set schema private;
alter function public.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  set schema private;

revoke all on function private.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  from public, anon;
revoke all on function private.apply_dashboard_task_action(uuid, text)
  from public, anon;
revoke all on function private.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  from public, anon;

grant execute on function private.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  to authenticated;
grant execute on function private.apply_dashboard_task_action(uuid, text)
  to authenticated;
grant execute on function private.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  to authenticated;

create function public.create_hq_task(
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
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_hq_task(
    requested_workspace_id,
    requested_agent_id,
    requested_title,
    requested_description,
    requested_priority,
    requested_scheduled_for,
    requested_max_attempts,
    requested_input
  );
$$;

create function public.apply_dashboard_task_action(
  requested_task_id uuid,
  requested_action text
)
returns public.tasks
language sql
security invoker
set search_path = ''
as $$
  select * from private.apply_dashboard_task_action(requested_task_id, requested_action);
$$;

create function public.create_interval_schedule(
  requested_workspace_id uuid,
  requested_agent_id uuid,
  requested_name text,
  requested_interval_seconds integer,
  requested_next_run_at timestamptz,
  requested_task_template jsonb
)
returns public.schedules
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_interval_schedule(
    requested_workspace_id,
    requested_agent_id,
    requested_name,
    requested_interval_seconds,
    requested_next_run_at,
    requested_task_template
  );
$$;

revoke all on function public.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  from public, anon;
revoke all on function public.apply_dashboard_task_action(uuid, text)
  from public, anon;
revoke all on function public.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  from public, anon;

grant execute on function public.create_hq_task(uuid, uuid, text, text, integer, timestamptz, integer, jsonb)
  to authenticated;
grant execute on function public.apply_dashboard_task_action(uuid, text)
  to authenticated;
grant execute on function public.create_interval_schedule(uuid, uuid, text, integer, timestamptz, jsonb)
  to authenticated;
