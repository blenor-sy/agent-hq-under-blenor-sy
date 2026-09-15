"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@/lib/types";

export function TaskActions({
  taskId,
  status,
  supportsPause = false,
}: {
  taskId: string;
  status: TaskStatus;
  supportsPause?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions: Array<{
    action: "cancel" | "retry" | "pause" | "resume";
    label: string;
    danger?: boolean;
  }> = [];
  if (["queued", "claimed", "running", "paused", "pause_requested"].includes(status))
    actions.push({ action: "cancel", label: "Cancel", danger: true });
  if (status === "running" && supportsPause)
    actions.push({ action: "pause", label: "Request pause" });
  if (status === "paused" && supportsPause) actions.push({ action: "resume", label: "Resume" });
  if (["failed", "cancelled"].includes(status)) actions.push({ action: "retry", label: "Retry" });
  async function run(action: "cancel" | "retry" | "pause" | "resume") {
    setPending(action);
    setError(null);
    const response = await fetch(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await response.json();
    setPending(null);
    if (!response.ok) {
      setError(body?.error?.message ?? "Command failed.");
      return;
    }
    router.refresh();
  }
  if (!actions.length) return null;
  return (
    <div className="task-actions">
      {actions.map((item) => (
        <button
          key={item.action}
          className={`button ${item.danger ? "danger" : "secondary"}`}
          disabled={Boolean(pending)}
          onClick={() => run(item.action)}
        >
          {pending === item.action ? "Working…" : item.label}
        </button>
      ))}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
