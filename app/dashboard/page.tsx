import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, Clock3, Plus } from "lucide-react";
import { Elapsed } from "@/components/elapsed";
import { StatusPill } from "@/components/status-pill";
import { getDashboardContext } from "@/lib/dashboard";
import { getAgentHealth, relativeTime } from "@/lib/time";
import type { AgentRecord, TaskRecord } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, workspace } = await getDashboardContext();
  const [agentResult, taskResult, eventResult] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("agent_events")
      .select("id,agent_id,task_id,type,message,level,created_at,occurred_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (agentResult.error) throw agentResult.error;
  if (taskResult.error) throw taskResult.error;
  if (eventResult.error) throw eventResult.error;
  const agents = (agentResult.data ?? []) as AgentRecord[];
  const tasks = (taskResult.data ?? []) as TaskRecord[];
  const activeTasks = tasks.filter((task) =>
    ["claimed", "running", "pause_requested", "cancel_requested"].includes(task.status),
  );
  const completed = tasks.filter((task) => task.status === "completed").length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">CONTROL ROOM</p>
          <h1>Good evening, Blenor.</h1>
          <p className="muted">A truthful view of every connected runtime.</p>
        </div>
        <Link className="button primary" href="/dashboard/tasks/new">
          <Plus size={17} /> New task
        </Link>
      </header>

      <section className="stats-grid" aria-label="Workspace statistics">
        <Stat
          icon={<Bot />}
          label="Registered agents"
          value={agents.length}
          detail={`${agents.filter((a) => getAgentHealth(a.last_seen_at) === "live").length} live`}
        />
        <Stat
          icon={<Clock3 />}
          label="Active tasks"
          value={activeTasks.length}
          detail={`${tasks.filter((t) => t.status === "queued").length} queued`}
        />
        <Stat icon={<CheckCircle2 />} label="Completed" value={completed} detail="Stored history" />
        <Stat
          icon={<CircleAlert />}
          label="Failed"
          value={failed}
          detail={failed ? "Needs attention" : "No failures"}
          {...(failed ? { tone: "danger" as const } : {})}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Agent fleet</h2>
            <p>Health comes from persisted heartbeats.</p>
          </div>
          <Link href="/dashboard/agents">
            View all <ArrowRight size={15} />
          </Link>
        </div>
        {agents.length === 0 ? (
          <Empty
            title="No agents connected"
            description="Register your first agent to begin receiving real heartbeats and task events."
            action="Connect an agent"
            href="/dashboard/agents/new"
          />
        ) : (
          <div className="agent-grid">
            {agents.slice(0, 6).map((agent) => {
              const health = getAgentHealth(agent.last_seen_at);
              const active = activeTasks.find((task) => task.agent_id === agent.id);
              const displayStatus = health === "live" ? agent.status : health;
              return (
                <Link className="agent-card" href={`/dashboard/agents/${agent.id}`} key={agent.id}>
                  <div className="agent-card-top">
                    <span className="agent-icon">{agent.name.slice(0, 2).toUpperCase()}</span>
                    <StatusPill value={displayStatus} />
                  </div>
                  <h3>{agent.name}</h3>
                  <p>{agent.description || agent.runtime_type}</p>
                  <div className="agent-activity">
                    <small>CURRENT ACTIVITY</small>
                    <strong>
                      {active?.title ??
                        (displayStatus === "offline" ? "Runtime offline" : "No active task")}
                    </strong>
                    <span>
                      {active?.current_step ??
                        (health === "stale" ? "Heartbeat is late" : "Waiting for work")}
                    </span>
                  </div>
                  {active && (
                    <div className="task-metrics">
                      {active.progress == null ? (
                        <span>Progress unavailable</span>
                      ) : (
                        <span>{active.progress}% reported</span>
                      )}
                      <span>
                        <Elapsed start={active.started_at} />
                      </span>
                    </div>
                  )}
                  <footer>Last heartbeat {relativeTime(agent.last_seen_at)}</footer>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Persisted events, newest first.</p>
          </div>
          <Link href="/dashboard/activity">
            Full timeline <ArrowRight size={15} />
          </Link>
        </div>
        <div className="table-card activity-list">
          {(eventResult.data ?? []).map((event) => (
            <div className="activity-row" key={event.id}>
              <span className={`event-dot level-${event.level}`} />
              <div>
                <strong>{agentNames.get(event.agent_id) ?? "Agent"}</strong>
                <p>{event.message || event.type.replaceAll("_", " ")}</p>
              </div>
              <StatusPill value={event.type} />
              <time dateTime={event.occurred_at}>{relativeTime(event.occurred_at)}</time>
            </div>
          ))}
          {eventResult.data?.length === 0 && (
            <div className="empty-inline">No agent activity has been reported yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone?: "danger";
}) {
  return (
    <article className={`stat-card ${tone ?? ""}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function Empty({
  title,
  description,
  action,
  href,
}: {
  title: string;
  description: string;
  action: string;
  href: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Bot />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="button secondary" href={href}>
        {action}
      </Link>
    </div>
  );
}
