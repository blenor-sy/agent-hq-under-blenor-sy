-- Agent HQ production schema upgrade.
-- Existing rows are quarantined in an ownerless legacy workspace until explicitly assigned.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id, workspace_id);
create unique index if not exists idx_workspaces_one_personal_owner
  on public.workspaces(owner_id)
  where owner_id is not null;

do $$
declare
  legacy_workspace_id uuid;
begin
  if exists (select 1 from public.agents limit 1) then
    insert into public.workspaces(name, owner_id)
    values ('Legacy import — assign an owner before use', null)
    returning id into legacy_workspace_id;
  end if;

  alter table public.agents add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

  if legacy_workspace_id is not null then
    update public.agents set workspace_id = legacy_workspace_id where workspace_id is null;
  end if;
end $$;

insert into public.workspaces(name, owner_id)
select coalesce(nullif(split_part(u.email, '@', 1), ''), 'My') || '''s Agent HQ', u.id
from auth.users u
where not exists (select 1 from public.workspaces w where w.owner_id = u.id)
on conflict do nothing;

insert into public.workspace_members(workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where w.owner_id is not null
on conflict do nothing;

alter table public.agents alter column workspace_id set not null;
alter table public.agents add column if not exists runtime_type text not null default 'custom';
alter table public.agents add column if not exists runtime_version text;
alter table public.agents add column if not exists version text;
alter table public.agents add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.agents add column if not exists icon_url text;
alter table public.agents add column if not exists max_concurrency integer not null default 1;
alter table public.agents add column if not exists deleted_at timestamptz;
alter table public.agents drop constraint if exists agents_status_check;
alter table public.agents add constraint agents_status_check
  check (status in ('idle','working','paused','error','offline'));
alter table public.agents add constraint agents_max_concurrency_check
  check (max_concurrency between 1 and 50);
alter table public.agents drop constraint if exists agents_slug_key;
create unique index if not exists idx_agents_workspace_slug
  on public.agents(workspace_id, slug)
  where deleted_at is null;

alter table public.agent_tokens add column if not exists label text not null default 'default';
alter table public.agent_tokens add column if not exists last_used_at timestamptz;
alter table public.agent_tokens add column if not exists expires_at timestamptz;
alter table public.agent_tokens add column if not exists token_prefix text;
alter table public.agent_tokens add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  runtime_type text not null check (char_length(runtime_type) between 1 and 80),
  runtime_version text not null check (char_length(runtime_version) between 1 and 80),
  status text not null default 'online' check (status in ('online','busy','draining','offline','error')),
  last_heartbeat_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, name)
);

alter table public.tasks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.tasks t set workspace_id = a.workspace_id from public.agents a
where t.agent_id = a.id and t.workspace_id is null;
alter table public.tasks alter column workspace_id set not null;
alter table public.tasks alter column external_id drop not null;
alter table public.tasks alter column progress drop not null;
alter table public.tasks alter column progress drop default;
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists input jsonb not null default '{}'::jsonb;
alter table public.tasks add column if not exists output jsonb;
alter table public.tasks add column if not exists priority integer not null default 0;
alter table public.tasks add column if not exists scheduled_for timestamptz;
alter table public.tasks add column if not exists queued_at timestamptz not null default now();
alter table public.tasks add column if not exists claimed_at timestamptz;
alter table public.tasks add column if not exists acknowledged_at timestamptz;
alter table public.tasks add column if not exists lease_id uuid;
alter table public.tasks add column if not exists lease_owner_id uuid references public.workers(id) on delete set null;
alter table public.tasks add column if not exists lease_expires_at timestamptz;
alter table public.tasks add column if not exists attempt_count integer not null default 0;
alter table public.tasks add column if not exists max_attempts integer not null default 3;
alter table public.tasks add column if not exists cancel_requested_at timestamptz;
alter table public.tasks add column if not exists last_event_at timestamptz;
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (
  status in ('queued','claimed','running','pause_requested','paused','cancel_requested','completed','failed','cancelled')
);
alter table public.tasks add constraint tasks_priority_check check (priority between -100 and 100);
alter table public.tasks add constraint tasks_attempts_check
  check (attempt_count >= 0 and max_attempts between 1 and 10 and attempt_count <= max_attempts);
alter table public.tasks drop constraint if exists tasks_agent_id_external_id_key;
create unique index if not exists idx_tasks_agent_external
  on public.tasks(agent_id, external_id)
  where external_id is not null;
create index if not exists idx_tasks_queue_claim
  on public.tasks(agent_id, priority desc, scheduled_for, queued_at)
  where status = 'queued';
create index if not exists idx_tasks_workspace_status_updated
  on public.tasks(workspace_id, status, updated_at desc);
create index if not exists idx_tasks_lease_expiry
  on public.tasks(lease_expires_at)
  where status in ('claimed','running','pause_requested','cancel_requested');

create table if not exists public.task_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  worker_id uuid references public.workers(id) on delete set null,
  lease_id uuid not null,
  status text not null default 'claimed' check (status in ('claimed','running','completed','failed','cancelled','lease_expired')),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, attempt_number),
  unique(lease_id)
);
create index if not exists idx_task_attempts_task on public.task_attempts(task_id, attempt_number desc);
create index if not exists idx_task_attempts_worker on public.task_attempts(worker_id, created_at desc);

alter table public.agent_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.agent_events e set workspace_id = a.workspace_id from public.agents a
where e.agent_id = a.id and e.workspace_id is null;
alter table public.agent_events alter column workspace_id set not null;
alter table public.agent_events add column if not exists event_id text;
alter table public.agent_events add column if not exists occurred_at timestamptz;
alter table public.agent_events add column if not exists level text not null default 'info';
alter table public.agent_events add constraint agent_events_level_check
  check (level in ('debug','info','warn','error'));
update public.agent_events set event_id = id::text where event_id is null;
alter table public.agent_events alter column event_id set not null;
update public.agent_events set occurred_at = created_at where occurred_at is null;
alter table public.agent_events alter column occurred_at set not null;
create unique index if not exists idx_events_agent_event_id on public.agent_events(agent_id, event_id);
create index if not exists idx_events_task_created on public.agent_events(task_id, created_at desc);
create index if not exists idx_events_workspace_created on public.agent_events(workspace_id, created_at desc);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  kind text not null default 'file',
  url text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);
create index if not exists idx_artifacts_task on public.artifacts(task_id, created_at desc);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  cron_expression text not null,
  timezone text not null default 'UTC',
  task_template jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_schedules_due on public.schedules(next_run_at) where enabled;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_workspace_unread
  on public.notifications(workspace_id, created_at desc) where read_at is null;

create table if not exists public.command_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_worker_id uuid references public.workers(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_command_audit_workspace on public.command_audit(workspace_id, created_at desc);
create index if not exists idx_command_audit_task on public.command_audit(task_id, created_at desc);

create or replace function private.is_workspace_member(requested_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requested_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;

create or replace function private.is_workspace_admin(requested_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requested_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  );
$$;
revoke all on function private.is_workspace_admin(uuid) from public, anon;
grant execute on function private.is_workspace_admin(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces(name, owner_id)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s Agent HQ', new.id)
  returning id into new_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_agent_hq on auth.users;
create trigger on_auth_user_created_agent_hq
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Remove the starter's anonymous policies and privileges before defining owner policies.
drop policy if exists "MVP dashboard can read agents" on public.agents;
drop policy if exists "MVP dashboard can read tasks" on public.tasks;
drop policy if exists "MVP dashboard can read events" on public.agent_events;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workers enable row level security;
alter table public.task_attempts enable row level security;
alter table public.artifacts enable row level security;
alter table public.schedules enable row level security;
alter table public.notifications enable row level security;
alter table public.command_audit enable row level security;

create policy workspaces_member_select on public.workspaces for select to authenticated
  using ((select private.is_workspace_member(id)));
create policy workspaces_admin_update on public.workspaces for update to authenticated
  using ((select private.is_workspace_admin(id)))
  with check ((select private.is_workspace_admin(id)));
create policy workspace_members_member_select on public.workspace_members for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy agents_member_select on public.agents for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy tasks_member_select on public.tasks for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy events_member_select on public.agent_events for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy workers_member_select on public.workers for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy attempts_member_select on public.task_attempts for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy artifacts_member_select on public.artifacts for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy schedules_member_select on public.schedules for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy notifications_member_select on public.notifications for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy notifications_member_update on public.notifications for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));
create policy audit_member_select on public.command_audit for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

revoke all on public.agent_tokens from anon, authenticated;
grant select on public.workspaces, public.workspace_members, public.agents, public.tasks,
  public.agent_events, public.workers, public.task_attempts, public.artifacts,
  public.schedules, public.notifications, public.command_audit to authenticated;
grant update on public.workspaces, public.notifications to authenticated;

-- Atomic, non-blocking claim. Only the server service role may invoke this RPC.
create or replace function public.claim_next_task(
  requested_agent_id uuid,
  requested_worker_id uuid,
  requested_lease_seconds integer default 60
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.tasks;
  new_lease_id uuid := gen_random_uuid();
begin
  if requested_lease_seconds < 15 or requested_lease_seconds > 300 then
    raise exception 'lease duration must be between 15 and 300 seconds';
  end if;
  if not exists (
    select 1 from public.workers w
    where w.id = requested_worker_id and w.agent_id = requested_agent_id
  ) then
    raise exception 'worker is not registered for this agent';
  end if;

  update public.tasks t
  set status = 'claimed',
      claimed_at = now(),
      lease_id = new_lease_id,
      lease_owner_id = requested_worker_id,
      lease_expires_at = now() + make_interval(secs => requested_lease_seconds),
      attempt_count = t.attempt_count + 1,
      updated_at = now()
  where t.id = (
    select candidate.id from public.tasks candidate
    where candidate.agent_id = requested_agent_id
      and candidate.status = 'queued'
      and candidate.attempt_count < candidate.max_attempts
      and (candidate.scheduled_for is null or candidate.scheduled_for <= now())
    order by candidate.priority desc, candidate.queued_at asc
    limit 1 for update skip locked
  )
  returning t.* into claimed;

  if claimed.id is not null then
    insert into public.task_attempts(
      workspace_id, task_id, attempt_number, worker_id, lease_id, status
    ) values (
      claimed.workspace_id, claimed.id, claimed.attempt_count, requested_worker_id, new_lease_id, 'claimed'
    );
    insert into public.command_audit(
      workspace_id, task_id, agent_id, actor_worker_id, action, from_status, to_status
    ) values (
      claimed.workspace_id, claimed.id, claimed.agent_id, requested_worker_id,
      'claim', 'queued', 'claimed'
    );
  end if;
  return claimed;
end;
$$;
revoke all on function public.claim_next_task(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_next_task(uuid, uuid, integer) to service_role;

create or replace function public.release_expired_task_leases()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer;
begin
  with expired as (
    update public.tasks t
    set status = case when t.attempt_count < t.max_attempts then 'queued' else 'failed' end,
        error_message = case when t.attempt_count < t.max_attempts then t.error_message else 'Worker lease expired and no attempts remain.' end,
        finished_at = case when t.attempt_count < t.max_attempts then null else now() end,
        lease_id = null,
        lease_owner_id = null,
        lease_expires_at = null,
        updated_at = now()
    where t.status in ('claimed','running','pause_requested','cancel_requested')
      and t.lease_expires_at < now()
    returning t.id, t.workspace_id, t.agent_id, t.attempt_count, t.status
  )
  select count(*) into released_count from expired;

  update public.task_attempts a
  set status = 'lease_expired', finished_at = now(), updated_at = now(),
      error_message = 'Worker lease expired.'
  where a.status in ('claimed','running')
    and exists (
      select 1 from public.tasks t
      where t.id = a.task_id and t.lease_id is null and t.updated_at >= now() - interval '5 seconds'
    );
  return released_count;
end;
$$;
revoke all on function public.release_expired_task_leases() from public, anon, authenticated;
grant execute on function public.release_expired_task_leases() to service_role;

create or replace function public.mark_stale_agents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.agents
  set status = 'offline', updated_at = now()
  where deleted_at is null
    and status <> 'offline'
    and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
  get diagnostics changed = row_count;
  update public.workers
  set status = 'offline', updated_at = now()
  where status <> 'offline' and last_heartbeat_at < now() - interval '5 minutes';
  return changed;
end;
$$;
revoke all on function public.mark_stale_agents() from public, anon, authenticated;
grant execute on function public.mark_stale_agents() to service_role;

-- New tables may not be Data API visible in newer Supabase projects without explicit grants.
grant usage on schema public to authenticated, service_role;

-- Realtime is a convenience; persisted rows remain canonical.
do $$
begin
  alter publication supabase_realtime add table public.workers;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_attempts;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.artifacts;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
