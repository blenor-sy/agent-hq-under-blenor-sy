import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Elapsed } from "@/components/elapsed";
import { StatusPill } from "@/components/status-pill";
import { getDashboardContext } from "@/lib/dashboard";
import { TASK_STATUSES, type TaskRecord } from "@/lib/types";
import { relativeTime } from "@/lib/time";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, workspace } = await getDashboardContext();
  const status = TASK_STATUSES.includes(filters.status as (typeof TASK_STATUSES)[number])
    ? filters.status
    : null;
  const queryText = (filters.q ?? "").trim().slice(0, 100);
  let query = supabase
    .from("tasks")
    .select("*,agents!inner(name)")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  if (queryText)
    query = query.ilike("title", `%${queryText.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">DURABLE QUEUE</p>
          <h1>Tasks</h1>
          <p className="muted">Queued, active, completed, failed, and retried work.</p>
        </div>
        <Link className="button primary" href="/dashboard/tasks/new">
          <Plus size={17} /> New task
        </Link>
      </header>
      <form className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input name="q" defaultValue={queryText} placeholder="Search task titles" />
        </label>
        <select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((item) => (
            <option value={item} key={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="button secondary">Filter</button>
        {(queryText || status) && (
          <Link className="button ghost" href="/dashboard/tasks">
            Clear
          </Link>
        )}
      </form>
      <div className="table-card responsive-table">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Agent</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Duration</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => {
              const task = row as TaskRecord & {
                agents: { name: string } | Array<{ name: string }>;
              };
              const agent = Array.isArray(task.agents) ? task.agents[0] : task.agents;
              return (
                <tr key={task.id}>
                  <td>
                    <Link className="table-primary" href={`/dashboard/tasks/${task.id}`}>
                      {task.title}
                      <small>{task.current_step ?? "No current step reported"}</small>
                    </Link>
                  </td>
                  <td>{agent?.name ?? "Unknown"}</td>
                  <td>
                    <StatusPill value={task.status} />
                  </td>
                  <td>{task.priority > 0 ? "High" : task.priority < 0 ? "Low" : "Normal"}</td>
                  <td>
                    <Elapsed start={task.started_at} end={task.finished_at} />
                  </td>
                  <td>{relativeTime(task.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data?.length === 0 && <div className="empty-inline">No tasks match these filters.</div>}
      </div>
    </div>
  );
}
