import { apiError, apiJson, readJson } from "@/lib/api";
import { authenticateAgent, enforceAgentRateLimit } from "@/lib/auth";
import { eventSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = eventSchema.parse(await readJson(request));
    const { admin, agentId, tokenHash } = await authenticateAgent(request);
    await enforceAgentRateLimit(admin, tokenHash, "events", 600);
    const { data, error } = await admin.rpc("ingest_agent_event", {
      requested_agent_id: agentId,
      requested_event_id: input.eventId,
      requested_type: input.type,
      requested_occurred_at: input.occurredAt ?? new Date().toISOString(),
      requested_task_external_id: input.taskExternalId ?? null,
      requested_title: input.title ?? null,
      requested_message: input.message ?? null,
      requested_progress: input.progress ?? null,
      requested_error: input.error ?? null,
      requested_level: input.level ?? "info",
      requested_payload: { ...input.metadata, runtimeVersion: input.runtimeVersion },
      requested_artifact: input.artifact ?? null,
    });
    if (error) throw error;
    return apiJson(data);
  } catch (error) {
    return apiError(error);
  }
}
