import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getDashboardContext } from "@/lib/dashboard";
import { getAgentHealth, relativeTime } from "@/lib/time";
import type { AgentRecord } from "@/lib/types";

export default async function AgentsPage() {
  const { supabase, workspace } = await getDashboardContext();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  const agents = (data ?? []) as AgentRecord[];
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">AGENT FLEET</p>
          <h1>Agents</h1>
          <p className="muted">Independent runtimes reporting into this workspace.</p>
        </div>
        <Link className="button primary" href="/dashboard/agents/new">
          <Plus size={17} /> Connect agent
        </Link>
      </header>
      {agents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Bot />
          </span>
          <h2>No agents yet</h2>
          <p>Connect School Assistant, Spanish Assistant, or any future compatible runtime.</p>
          <Link className="button secondary" href="/dashboard/agents/new">
            Connect your first agent
          </Link>
        </div>
      ) : (
        <div className="table-card responsive-table">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Health</th>
                <th>Runtime</th>
                <th>Version</th>
                <th>Last heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const health = getAgentHealth(agent.last_seen_at);
                return (
                  <tr key={agent.id}>
                    <td>
                      <Link className="table-primary" href={`/dashboard/agents/${agent.id}`}>
                        {agent.name}
                        <small>{agent.slug}</small>
                      </Link>
                    </td>
                    <td>
                      <StatusPill value={health === "live" ? agent.status : health} />
                    </td>
                    <td>{agent.runtime_type}</td>
                    <td>{agent.runtime_version ?? agent.version ?? "Not reported"}</td>
                    <td>{relativeTime(agent.last_seen_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
