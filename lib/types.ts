export const AGENT_STATUSES = ["idle", "working", "paused", "error", "offline"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentHealth = "live" | "stale" | "offline" | "never_seen";

export const TASK_STATUSES = [
  "queued",
  "claimed",
  "running",
  "pause_requested",
  "paused",
  "cancel_requested",
  "completed",
  "failed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVENT_TYPES = [
  "agent_registered",
  "online",
  "offline",
  "task_queued",
  "task_claimed",
  "task_acknowledged",
  "task_started",
  "progress",
  "current_step",
  "heartbeat",
  "log",
  "artifact_produced",
  "task_completed",
  "task_failed",
  "task_cancelled",
  "idle",
] as const;
export type AgentEventType = (typeof EVENT_TYPES)[number];

export interface AgentRecord {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description: string | null;
  capabilities: string[];
  runtime_type: string;
  runtime_version: string | null;
  version: string | null;
  status: AgentStatus;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  icon_url: string | null;
  max_concurrency: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  external_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  progress: number | null;
  current_step: string | null;
  error_message: string | null;
  scheduled_for: string | null;
  queued_at: string;
  claimed_at: string | null;
  acknowledged_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
  max_attempts: number;
  input_tokens: number | null;
  output_tokens: number | null;
  api_requests: number | null;
  estimated_cost: number | null;
  cost_currency: string | null;
  created_at: string;
  updated_at: string;
}
