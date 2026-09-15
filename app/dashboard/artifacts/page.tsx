import { FileOutput } from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard";
import { relativeTime } from "@/lib/time";

export default async function ArtifactsPage() {
  const { supabase, workspace } = await getDashboardContext();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*,agents!inner(name),tasks(title)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">OUTPUTS</p>
          <h1>Artifacts</h1>
          <p className="muted">Files and links explicitly reported by compatible runtimes.</p>
        </div>
      </header>
      {data?.length ? (
        <div className="artifact-grid">
          {data.map((artifact) => {
            const agent = Array.isArray(artifact.agents) ? artifact.agents[0] : artifact.agents;
            const task = Array.isArray(artifact.tasks) ? artifact.tasks[0] : artifact.tasks;
            return (
              <article className="artifact-card" key={artifact.id}>
                <span className="artifact-icon">
                  <FileOutput />
                </span>
                <div>
                  <h3>{artifact.name}</h3>
                  <p>
                    {agent?.name ?? "Agent"} · {task?.title ?? "No task"}
                  </p>
                  <small>
                    {artifact.mime_type ?? artifact.kind} · {relativeTime(artifact.created_at)}
                  </small>
                </div>
                {artifact.url ? (
                  <a
                    className="button secondary"
                    href={artifact.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                ) : (
                  <span className="muted">Stored path only</span>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <FileOutput />
          </span>
          <h2>No artifacts yet</h2>
          <p>Files appear here only when an agent reports a real artifact event.</p>
        </div>
      )}
    </div>
  );
}
