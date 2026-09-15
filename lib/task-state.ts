import type { TaskStatus } from "@/lib/types";

const allowedTransitions: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
  queued: new Set(["claimed", "cancel_requested", "cancelled"]),
  claimed: new Set(["queued", "running", "cancel_requested", "cancelled", "failed"]),
  running: new Set(["pause_requested", "cancel_requested", "completed", "failed"]),
  pause_requested: new Set(["paused", "running", "cancel_requested", "failed"]),
  paused: new Set(["queued", "running", "cancel_requested", "cancelled", "failed"]),
  cancel_requested: new Set(["cancelled", "completed", "failed"]),
  completed: new Set(),
  failed: new Set(["queued"]),
  cancelled: new Set(["queued"]),
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || allowedTransitions[from].has(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) {
    throw new Error(`Invalid task transition: ${from} -> ${to}`);
  }
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
