import Link from "next/link";
import { NewTaskForm } from "@/components/new-task-form";
import { getDashboardContext } from "@/lib/dashboard";

export default async function NewTaskPage() {
  const { supabase, workspace } = await getDashboardContext();
  const { data, error } = await supabase
    .from("agents")
    .select("id,name")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (
    <div className="page-stack narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">COMMAND QUEUE</p>
          <h1>New task</h1>
          <p className="muted">Queue durable work for one compatible agent runtime.</p>
        </div>
      </header>
      {data?.length ? (
        <NewTaskForm workspaceId={workspace.id} agents={data} />
      ) : (
        <div className="empty-state">
          <h2>Connect an agent first</h2>
          <p>A task needs an intended agent identity before it can enter the queue.</p>
          <Link className="button primary" href="/dashboard/agents/new">
            Connect agent
          </Link>
        </div>
      )}
    </div>
  );
}
