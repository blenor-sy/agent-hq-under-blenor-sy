begin;
select plan(11);

insert into auth.users(id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-one@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'owner-two@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

select is((select count(*)::integer from public.workspaces where owner_id is not null), 2, 'new users receive personal workspaces');

insert into public.agents(workspace_id, slug, name, status)
select id, 'agent-one', 'Agent One', 'offline' from public.workspaces where owner_id = '11111111-1111-4111-8111-111111111111';
insert into public.agents(workspace_id, slug, name, status)
select id, 'agent-two', 'Agent Two', 'offline' from public.workspaces where owner_id = '22222222-2222-4222-8222-222222222222';

select ok(not has_table_privilege('anon','public.agents','select'), 'anonymous users cannot read agents');
select ok(not has_table_privilege('anon','public.tasks','select'), 'anonymous users cannot read tasks');
select ok(not has_table_privilege('anon','public.agent_events','select'), 'anonymous users cannot read events');
select ok(not has_table_privilege('authenticated','public.agent_tokens','select'), 'browser users cannot read agent token hashes');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*)::integer from public.agents), 1, 'users can read only their workspace agents');
reset role;

insert into public.workers(workspace_id, agent_id, name, runtime_type, runtime_version)
select workspace_id, id, 'test-worker', 'test', '1.0.0' from public.agents where slug = 'agent-one';
insert into public.tasks(workspace_id, agent_id, title, priority)
select workspace_id, id, 'lower priority', 0 from public.agents where slug = 'agent-one';
insert into public.tasks(workspace_id, agent_id, title, priority)
select workspace_id, id, 'higher priority', 10 from public.agents where slug = 'agent-one';

set local role service_role;
select is(
  (select title from public.claim_next_task(
    (select id from public.agents where slug = 'agent-one'),
    (select id from public.workers where name = 'test-worker'), 60
  )), 'higher priority', 'claim chooses highest priority task'
);
select is(
  (select title from public.claim_next_task(
    (select id from public.agents where slug = 'agent-one'),
    (select id from public.workers where name = 'test-worker'), 60
  )), 'lower priority', 'a second claim cannot duplicate the first task'
);

select is(
  (public.ingest_agent_event(
    (select id from public.agents where slug = 'agent-one'), 'event-idempotency-1', 'heartbeat', now(),
    null, null, 'alive', null, null, 'info', '{}', null
  )->>'duplicate')::boolean,
  false,
  'first event is accepted'
);
select is(
  (public.ingest_agent_event(
    (select id from public.agents where slug = 'agent-one'), 'event-idempotency-1', 'heartbeat', now(),
    null, null, 'alive', null, null, 'info', '{}', null
  )->>'duplicate')::boolean,
  true,
  'duplicate event is idempotent'
);
select is((select count(*)::integer from public.agent_events where event_id = 'event-idempotency-1'), 1, 'duplicate event creates one stored row');

select * from finish();
rollback;
