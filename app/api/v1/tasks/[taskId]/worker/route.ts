import { ApiError, apiError, apiJson, readJson } from "@/lib/api";
import { authenticateAgent, enforceAgentRateLimit } from "@/lib/auth";
import { taskActionSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(taskId))
      throw new ApiError(400, "invalid_task_id", "Task ID is invalid.");
    const input = taskActionSchema.parse(await readJson(request));
    const { admin, agentId, tokenHash } = await authenticateAgent(request);
    await enforceAgentRateLimit(admin, tokenHash, "task-update", 600);
    const { data: worker, error: workerError } = await admin
      .from("workers")
      .select("id")
      .eq("agent_id", agentId)
      .eq("id", request.headers.get("agent-hq-worker-id") ?? "")
      .maybeSingle();
    if (workerError || !worker)
      throw new ApiError(403, "invalid_worker", "Worker identity is invalid.");
    const { data, error } = await admin.rpc("apply_worker_task_action", {
      requested_agent_id: agentId,
      requested_worker_id: worker.id,
      requested_task_id: taskId,
      requested_lease_id: input.leaseId,
      requested_action: input.action,
      requested_message: input.message ?? null,
      requested_error: input.error ?? null,
      requested_progress: input.progress ?? null,
    });
    if (error) throw error;
    return apiJson({ task: data });
  } catch (error) {
    return apiError(error);
  }
}
