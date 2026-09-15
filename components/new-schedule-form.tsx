"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewScheduleForm({
  workspaceId,
  agents,
}: {
  workspaceId: string;
  agents: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const firstRun = String(form.get("firstRun") ?? "");
    const response = await fetch("/api/v1/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        agentId: form.get("agentId"),
        name: form.get("name"),
        intervalMinutes: Number(form.get("intervalMinutes")),
        nextRunAt: new Date(firstRun).toISOString(),
        task: {
          title: form.get("title"),
          description: form.get("description") || undefined,
          priority: Number(form.get("priority") ?? 0),
          maxAttempts: 3,
        },
      }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) setError(body?.error?.message ?? "Schedule could not be created.");
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }
  return (
    <form className="form-card form-stack" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Schedule name
          <input name="name" required placeholder="Daily homework check" />
        </label>
        <label>
          Agent
          <select name="agentId" required defaultValue="">
            <option value="" disabled>
              Select agent
            </option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Task title
        <input name="title" required placeholder="Check new homework" />
      </label>
      <label>
        Task instructions
        <textarea name="description" rows={3} />
      </label>
      <div className="form-grid">
        <label>
          Repeat every (minutes)
          <input
            name="intervalMinutes"
            type="number"
            min="5"
            max="525600"
            defaultValue="1440"
            required
          />
        </label>
        <label>
          First run
          <input name="firstRun" type="datetime-local" required />
        </label>
      </div>
      <label>
        Priority
        <select name="priority" defaultValue="0">
          <option value="10">High</option>
          <option value="0">Normal</option>
          <option value="-10">Low</option>
        </select>
      </label>
      {error && <div className="alert error">{error}</div>}
      <button className="button primary" disabled={loading}>
        {loading ? "Saving…" : "Create schedule"}
      </button>
    </form>
  );
}
