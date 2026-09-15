import { apiError, apiJson, readJson } from "@/lib/api";
import { authenticateAgent, enforceAgentRateLimit } from "@/lib/auth";
import { claimTaskSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = claimTaskSchema.parse(await readJson(request));
    const { admin, agentId, tokenHash } = await authenticateAgent(request);
    await enforceAgentRateLimit(admin, tokenHash, "task-claim", 120);
    const { data, error } = await admin.rpc("claim_next_task", {
      requested_agent_id: agentId,
      requested_worker_id: input.workerId,
      requested_lease_seconds: input.leaseSeconds,
    });
    if (error) throw error;
    return data ? apiJson({ task: data }) : new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
