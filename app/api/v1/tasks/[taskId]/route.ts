import { ApiError, apiError, apiJson, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { dashboardTaskActionSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(taskId))
      throw new ApiError(400, "invalid_task_id", "Task ID is invalid.");
    const input = dashboardTaskActionSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("apply_dashboard_task_action", {
      requested_task_id: taskId,
      requested_action: input.action,
    });
    if (error) throw error;
    return apiJson({ task: data });
  } catch (error) {
    return apiError(error);
  }
}
