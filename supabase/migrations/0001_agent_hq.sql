create extension if not exists pgcrypto;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  capabilities jsonb not null default '[]'::jsonb,
  status text not null default 'idle' check (status in ('idle','working','error','offline')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  external_id text not null,
  title text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  progress int not null default 0 check (progress between 0 and 100),
  current_step text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, external_id)
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  type text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agents_last_seen on public.agents(last_seen_at desc);
create index if not exists idx_tasks_agent_status on public.tasks(agent_id, status);
create index if not exists idx_events_created on public.agent_events(created_at desc);
create index if not exists idx_events_agent on public.agent_events(agent_id, created_at desc);

alter table public.agents enable row level security;
alter table public.agent_tokens enable row level security;
alter table public.tasks enable row level security;
alter table public.agent_events enable row level security;

grant select on public.agents, public.tasks, public.agent_events to anon, authenticated;

create policy "MVP dashboard can read agents" on public.agents for select to anon, authenticated using (true);
create policy "MVP dashboard can read tasks" on public.tasks for select to anon, authenticated using (true);
create policy "MVP dashboard can read events" on public.agent_events for select to anon, authenticated using (true);

revoke all on public.agent_tokens from anon, authenticated;

alter publication supabase_realtime add table public.agents;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.agent_events;
