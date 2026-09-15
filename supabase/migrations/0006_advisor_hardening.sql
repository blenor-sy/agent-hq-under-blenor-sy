-- Make service-only denial explicit and cover every foreign-key lookup/cascade.
create policy agent_tokens_deny_browser on public.agent_tokens for all to anon, authenticated
  using (false) with check (false);
create policy api_rate_limits_deny_browser on public.api_rate_limits for all to anon, authenticated
  using (false) with check (false);

create index if not exists idx_agent_tokens_agent on public.agent_tokens(agent_id);
create index if not exists idx_agent_tokens_created_by on public.agent_tokens(created_by);
create index if not exists idx_artifacts_agent on public.artifacts(agent_id);
create index if not exists idx_artifacts_workspace on public.artifacts(workspace_id);
create index if not exists idx_command_audit_actor_user on public.command_audit(actor_user_id);
create index if not exists idx_command_audit_actor_worker on public.command_audit(actor_worker_id);
create index if not exists idx_command_audit_agent on public.command_audit(agent_id);
create index if not exists idx_schedules_agent on public.schedules(agent_id);
create index if not exists idx_schedules_workspace on public.schedules(workspace_id);
create index if not exists idx_task_attempts_workspace on public.task_attempts(workspace_id);
create index if not exists idx_tasks_lease_owner on public.tasks(lease_owner_id);
create index if not exists idx_workers_workspace on public.workers(workspace_id);
