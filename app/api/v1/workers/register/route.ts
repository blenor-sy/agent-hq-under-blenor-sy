import { apiError, apiJson, readJson } from "@/lib/api";
import { authenticateAgent, enforceAgentRateLimit } from "@/lib/auth";
import { workerRegistrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = workerRegistrationSchema.parse(await readJson(request));
    const { admin, agentId, workspaceId, tokenHash } = await authenticateAgent(request);
    await enforceAgentRateLimit(admin, tokenHash, "worker-register", 20);
    const { data, error } = await admin
      .from("workers")
      .upsert(
        {
          workspace_id: workspaceId,
          agent_id: agentId,
          name: input.name,
          runtime_type: input.runtimeType,
          runtime_version: input.runtimeVersion,
          metadata: input.metadata,
          status: "online",
          last_heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_id,name" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return apiJson({ worker: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
