import { Search } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getDashboardContext } from "@/lib/dashboard";
import { relativeTime } from "@/lib/time";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, workspace } = await getDashboardContext();
  const level = ["debug", "info", "warn", "error"].includes(filters.level ?? "")
    ? filters.level
    : null;
  const queryText = (filters.q ?? "").trim().slice(0, 100);
  let query = supabase
    .from("agent_events")
    .select("id,type,message,level,occurred_at,agents!inner(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (level) query = query.eq("level", level);
  if (queryText)
    query = query.ilike("message", `%${queryText.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">EVENT HISTORY</p>
          <h1>Activity & logs</h1>
          <p className="muted">
            The latest 100 persisted events. Realtime delivery is only a refresh signal.
          </p>
        </div>
      </header>
      <form className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input name="q" defaultValue={queryText} placeholder="Search log messages" />
        </label>
        <select name="level" defaultValue={level ?? ""}>
          <option value="">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <button className="button secondary">Filter</button>
      </form>
      <div className="table-card activity-list">
        {(data ?? []).map((event) => {
          const relation = Array.isArray(event.agents) ? event.agents[0] : event.agents;
          return (
            <div className="activity-row" key={event.id}>
              <span className={`event-dot level-${event.level}`} />
              <div>
                <strong>{relation?.name ?? "Agent"}</strong>
                <p>{event.message || "No message reported"}</p>
              </div>
              <StatusPill value={event.type} />
              <time title={new Date(event.occurred_at).toLocaleString()}>
                {relativeTime(event.occurred_at)}
              </time>
            </div>
          );
        })}
        {data?.length === 0 && <div className="empty-inline">No events match these filters.</div>}
      </div>
    </div>
  );
}
