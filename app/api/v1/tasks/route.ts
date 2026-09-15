import { apiError, apiJson, readJson } from "@/lib/api";
import { requireWorkspaceRole } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = createTaskSchema.parse(await readJson(request));
    const { supabase } = await requireWorkspaceRole(input.workspaceId);
    const { data, error } = await supabase.rpc("create_hq_task", {
      requested_workspace_id: input.workspaceId,
      requested_agent_id: input.agentId,
      requested_title: input.title,
      requested_description: input.description ?? null,
      requested_priority: input.priority,
      requested_scheduled_for: input.scheduledFor ?? null,
      requested_max_attempts: input.maxAttempts,
      requested_input: input.input,
    });
    if (error) throw error;
    return apiJson({ task: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
