"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewTaskForm({
  workspaceId,
  agents,
}: {
  workspaceId: string;
  agents: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const scheduledValue = String(form.get("scheduledFor") ?? "");
    const response = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        agentId: form.get("agentId"),
        title: form.get("title"),
        description: form.get("description") || null,
        priority: Number(form.get("priority") ?? 0),
        maxAttempts: Number(form.get("maxAttempts") ?? 3),
        scheduledFor: scheduledValue ? new Date(scheduledValue).toISOString() : null,
      }),
    });
    const body = response.status === 204 ? null : await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body?.error?.message ?? "Task could not be queued.");
      return;
    }
    router.push(`/dashboard/tasks/${body.task.id}`);
    router.refresh();
  }
  return (
    <form className="form-card form-stack" onSubmit={submit}>
      <label>
        Agent
        <select name="agentId" required defaultValue="">
          <option value="" disabled>
            Select an agent
          </option>
          {agents.map((agent) => (
            <option value={agent.id} key={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Task title
        <input name="title" required maxLength={300} placeholder="What should the agent do?" />
      </label>
      <label>
        Description <span className="label-note">optional</span>
        <textarea
          name="description"
          rows={6}
          maxLength={10000}
          placeholder="Instructions, context, and a clear definition of done"
        />
      </label>
      <div className="form-grid">
        <label>
          Priority
          <select name="priority" defaultValue="0">
            <option value="10">High</option>
            <option value="0">Normal</option>
            <option value="-10">Low</option>
          </select>
        </label>
        <label>
          Maximum attempts
          <input name="maxAttempts" type="number" min="1" max="10" defaultValue="3" />
        </label>
      </div>
      <label>
        Schedule for <span className="label-note">optional, local time</span>
        <input name="scheduledFor" type="datetime-local" />
      </label>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="button ghost" onClick={() => router.back()}>
          Cancel
        </button>
        <button className="button primary" disabled={loading}>
          {loading ? "Queueing…" : "Queue task"}
        </button>
      </div>
    </form>
  );
}
