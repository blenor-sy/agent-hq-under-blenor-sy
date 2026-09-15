import { notFound } from "next/navigation";
import { Cpu, HeartPulse, Layers3, TimerReset } from "lucide-react";
import { Elapsed } from "@/components/elapsed";
import { StatusPill } from "@/components/status-pill";
import { TokenManager } from "@/components/token-manager";
import { getDashboardContext } from "@/lib/dashboard";
import { getAgentHealth, relativeTime } from "@/lib/time";
import type { AgentRecord, TaskRecord } from "@/lib/types";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const { supabase, workspace } = await getDashboardContext();
  const [agentResult, tasksResult, workersResult, eventsResult] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("id", agentId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*")
      .eq("agent_id", agentId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("workers")
      .select("*")
      .eq("agent_id", agentId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("agent_events")
      .select("id,type,message,level,occurred_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);
  if (!agentResult.data) notFound();
  if (tasksResult.error || workersResult.error || eventsResult.error)
    throw tasksResult.error ?? workersResult.error ?? eventsResult.error;
  const agent = agentResult.data as AgentRecord;
  const tasks = (tasksResult.data ?? []) as TaskRecord[];
  const health = getAgentHealth(agent.last_seen_at);
  const active = tasks.find((task) =>
    ["claimed", "running", "pause_requested", "cancel_requested"].includes(task.status),
  );
  return (
    <div className="page-stack">
      <header className="detail-hero">
        <div className="agent-icon large">{agent.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <p className="eyebrow">{agent.runtime_type}</p>
          <h1>{agent.name}</h1>
          <p>{agent.description || "No description provided."}</p>
        </div>
        <StatusPill value={health === "live" ? agent.status : health} />
      </header>
      <section className="detail-grid">
        <Info
          icon={<HeartPulse />}
          label="Heartbeat"
          value={relativeTime(agent.last_seen_at)}
          detail={
            health === "stale"
              ? "Late—state may be outdated"
              : health === "offline"
                ? "Runtime is offline"
                : "Live telemetry"
          }
        />
        <Info
          icon={<Cpu />}
          label="Runtime"
          value={agent.runtime_type}
          detail={agent.runtime_version ?? "Version not reported"}
        />
        <Info
          icon={<Layers3 />}
          label="Capabilities"
          value={String(agent.capabilities.length)}
          detail={agent.capabilities.join(", ") || "None reported"}
        />
        <Info
          icon={<TimerReset />}
          label="Concurrency"
          value={String(agent.max_concurrency)}
          detail="Maximum simultaneous tasks"
        />
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Current work</h2>
            <p>No percentage appears unless the runtime reports one.</p>
          </div>
        </div>
        {active ? (
          <div className="focus-task">
            <div>
              <StatusPill value={active.status} />
              <h3>
                <a href={`/dashboard/tasks/${active.id}`}>{active.title}</a>
              </h3>
              <p>{active.current_step ?? "Current step unavailable"}</p>
            </div>
            <div className="focus-metrics">
              <span>
                <small>ELAPSED</small>
                <strong>
                  <Elapsed start={active.started_at} />
                </strong>
              </span>
              <span>
                <small>PROGRESS</small>
                <strong>{active.progress == null ? "Unavailable" : `${active.progress}%`}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="empty-inline">This agent has no active task.</div>
        )}
      </section>
      <section className="split-grid">
        <div className="section-block">
          <div className="section-heading">
            <div>
              <h2>Workers</h2>
              <p>Persistent runtime processes.</p>
            </div>
          </div>
          <div className="table-card simple-list">
            {workersResult.data?.map((worker) => (
              <div key={worker.id}>
                <span>
                  <strong>{worker.name}</strong>
                  <small>
                    {worker.runtime_type} {worker.runtime_version}
                  </small>
                </span>
                <span>
                  <StatusPill value={worker.status} />
                  <small>{relativeTime(worker.last_heartbeat_at)}</small>
                </span>
              </div>
            ))}
            {workersResult.data?.length === 0 && (
              <div className="empty-inline">No worker has registered yet.</div>
            )}
          </div>
        </div>
        <div className="section-block">
          <div className="section-heading">
            <div>
              <h2>Recent events</h2>
              <p>Reported by this agent.</p>
            </div>
          </div>
          <div className="table-card simple-list">
            {eventsResult.data?.map((event) => (
              <div key={event.id}>
                <span>
                  <strong>{event.message || event.type.replaceAll("_", " ")}</strong>
                  <small>{relativeTime(event.occurred_at)}</small>
                </span>
                <StatusPill value={event.type} />
              </div>
            ))}
            {eventsResult.data?.length === 0 && (
              <div className="empty-inline">No events reported.</div>
            )}
          </div>
        </div>
      </section>
      <TokenManager agentId={agent.id} />
    </div>
  );
}

function Info({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="info-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
