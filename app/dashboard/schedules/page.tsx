import { CalendarClock } from "lucide-react";
import { NewScheduleForm } from "@/components/new-schedule-form";
import { StatusPill } from "@/components/status-pill";
import { getDashboardContext } from "@/lib/dashboard";

export default async function SchedulesPage() {
  const { supabase, workspace } = await getDashboardContext();
  const [scheduleResult, agentResult] = await Promise.all([
    supabase
      .from("schedules")
      .select("*,agents!inner(name)")
      .eq("workspace_id", workspace.id)
      .order("next_run_at"),
    supabase
      .from("agents")
      .select("id,name")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (scheduleResult.error || agentResult.error) throw scheduleResult.error ?? agentResult.error;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">BACKGROUND WORK</p>
          <h1>Schedules</h1>
          <p className="muted">
            Recurring tasks are queued by server maintenance, even when the dashboard is closed.
          </p>
        </div>
      </header>
      {agentResult.data?.length ? (
        <NewScheduleForm workspaceId={workspace.id} agents={agentResult.data} />
      ) : (
        <div className="info-banner">Connect an agent before creating a schedule.</div>
      )}
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Saved schedules</h2>
            <p>Minimum interval: five minutes.</p>
          </div>
        </div>
        {scheduleResult.data?.length ? (
          <div className="table-card responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Agent</th>
                  <th>Frequency</th>
                  <th>Next run</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduleResult.data.map((schedule) => {
                  const agent = Array.isArray(schedule.agents)
                    ? schedule.agents[0]
                    : schedule.agents;
                  return (
                    <tr key={schedule.id}>
                      <td>{schedule.name}</td>
                      <td>{agent?.name}</td>
                      <td>Every {Math.round(schedule.interval_seconds / 60)} min</td>
                      <td>
                        {schedule.next_run_at
                          ? new Date(schedule.next_run_at).toLocaleString()
                          : "Unavailable"}
                      </td>
                      <td>
                        <StatusPill value={schedule.enabled ? "enabled" : "paused"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <CalendarClock />
            </span>
            <h2>No schedules</h2>
            <p>
              Create a repeatable task above. It will only run when production maintenance is
              configured.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
