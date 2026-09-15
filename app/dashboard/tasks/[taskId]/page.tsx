import { notFound } from "next/navigation";
import { Clock, FileOutput, RotateCcw, Timer } from "lucide-react";
import { Elapsed } from "@/components/elapsed";
import { StatusPill } from "@/components/status-pill";
import { TaskActions } from "@/components/task-actions";
import { getDashboardContext } from "@/lib/dashboard";
import { relativeTime } from "@/lib/time";
import type { TaskRecord } from "@/lib/types";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const { supabase, workspace } = await getDashboardContext();
  const [taskResult, attemptsResult, eventsResult, artifactsResult, auditResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*,agents!inner(name,slug,capabilities)")
        .eq("workspace_id", workspace.id)
        .eq("id", taskId)
        .maybeSingle(),
      supabase
        .from("task_attempts")
        .select("*,workers(name)")
        .eq("task_id", taskId)
        .order("attempt_number", { ascending: false }),
      supabase
        .from("agent_events")
        .select("id,type,message,level,payload,occurred_at,created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("artifacts")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase
        .from("command_audit")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  if (!taskResult.data) notFound();
  const firstError =
    attemptsResult.error ?? eventsResult.error ?? artifactsResult.error ?? auditResult.error;
  if (firstError) throw firstError;
  const task = taskResult.data as TaskRecord & {
    agents:
      | { name: string; slug: string; capabilities: string[] }
      | Array<{ name: string; slug: string; capabilities: string[] }>;
  };
  const agent = Array.isArray(task.agents) ? task.agents[0] : task.agents;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">TASK · {agent?.name ?? "AGENT"}</p>
          <h1>{task.title}</h1>
          <p className="muted">{task.description || "No additional task description."}</p>
        </div>
        <StatusPill value={task.status} />
      </header>
      <TaskActions
        taskId={task.id}
        status={task.status}
        supportsPause={agent?.capabilities.includes("pause") ?? false}
      />
      {task.error_message && (
        <div className="alert error">
          <strong>Failure reason</strong>
          <br />
          {task.error_message}
        </div>
      )}
      <section className="detail-grid">
        <Info
          icon={<Timer />}
          label="Elapsed"
          value={<Elapsed start={task.started_at} end={task.finished_at} />}
          detail={task.started_at ? `Started ${relativeTime(task.started_at)}` : "Not started"}
        />
        <Info
          icon={<Clock />}
          label="Queue"
          value={relativeTime(task.queued_at)}
          detail={
            task.claimed_at ? `Claimed ${relativeTime(task.claimed_at)}` : "Waiting for claim"
          }
        />
        <Info
          icon={<RotateCcw />}
          label="Attempts"
          value={`${task.attempt_count} / ${task.max_attempts}`}
          detail={
            task.lease_expires_at
              ? `Lease expires ${relativeTime(task.lease_expires_at)}`
              : "No active lease"
          }
        />
        <Info
          icon={<FileOutput />}
          label="Progress"
          value={task.progress == null ? "Unavailable" : `${task.progress}%`}
          detail={task.current_step ?? "Current step unavailable"}
        />
      </section>
      {(task.input_tokens != null ||
        task.output_tokens != null ||
        task.api_requests != null ||
        task.estimated_cost != null) && (
        <section className="usage-strip" aria-label="Runtime-reported usage">
          <span>
            <small>INPUT TOKENS</small>
            <strong>{task.input_tokens?.toLocaleString() ?? "Not reported"}</strong>
          </span>
          <span>
            <small>OUTPUT TOKENS</small>
            <strong>{task.output_tokens?.toLocaleString() ?? "Not reported"}</strong>
          </span>
          <span>
            <small>API REQUESTS</small>
            <strong>{task.api_requests?.toLocaleString() ?? "Not reported"}</strong>
          </span>
          <span>
            <small>ESTIMATED COST</small>
            <strong>
              {task.estimated_cost == null
                ? "Not reported"
                : `${task.estimated_cost} ${task.cost_currency ?? ""}`.trim()}
            </strong>
          </span>
        </section>
      )}
      <section className="split-grid">
        <div className="section-block">
          <div className="section-heading">
            <div>
              <h2>Timeline</h2>
              <p>Agent and command events.</p>
            </div>
          </div>
          <div className="timeline">
            {eventsResult.data?.map((event) => (
              <div className="timeline-item" key={event.id}>
                <span className={`event-dot level-${event.level}`} />
                <div>
                  <div>
                    <StatusPill value={event.type} />
                    <time>{new Date(event.occurred_at).toLocaleString()}</time>
                  </div>
                  <p>{event.message || "No message reported"}</p>
                </div>
              </div>
            ))}
            {eventsResult.data?.length === 0 && (
              <div className="empty-inline">No events for this task.</div>
            )}
          </div>
        </div>
        <div className="section-block">
          <div className="section-heading">
            <div>
              <h2>Attempt history</h2>
              <p>Retries never hide prior failures.</p>
            </div>
          </div>
          <div className="table-card simple-list">
            {attemptsResult.data?.map((attempt) => (
              <div key={attempt.id}>
                <span>
                  <strong>Attempt {attempt.attempt_number}</strong>
                  <small>
                    {attempt.error_message ||
                      (attempt.started_at
                        ? `Started ${relativeTime(attempt.started_at)}`
                        : "Claimed")}
                  </small>
                </span>
                <StatusPill value={attempt.status} />
              </div>
            ))}
            {attemptsResult.data?.length === 0 && (
              <div className="empty-inline">No worker has claimed this task.</div>
            )}
          </div>
          <div className="section-heading compact">
            <div>
              <h2>Artifacts</h2>
              <p>Files reported by the runtime.</p>
            </div>
          </div>
          <div className="table-card simple-list">
            {artifactsResult.data?.map((artifact) => (
              <div key={artifact.id}>
                <span>
                  <strong>{artifact.name}</strong>
                  <small>
                    {artifact.mime_type ?? artifact.kind}
                    {artifact.size_bytes ? ` · ${artifact.size_bytes} bytes` : ""}
                  </small>
                </span>
                {artifact.url ? (
                  <a
                    className="button ghost small-button"
                    href={artifact.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                ) : (
                  <StatusPill value="stored" />
                )}
              </div>
            ))}
            {artifactsResult.data?.length === 0 && (
              <div className="empty-inline">No artifacts reported.</div>
            )}
          </div>
        </div>
      </section>
      <details className="audit-details">
        <summary>Command audit trail ({auditResult.data?.length ?? 0})</summary>
        <div className="simple-list">
          {auditResult.data?.map((entry) => (
            <div key={entry.id}>
              <span>{entry.action}</span>
              <span>
                {entry.from_status ?? "—"} → {entry.to_status ?? "—"} ·{" "}
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </details>
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
  value: React.ReactNode;
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
