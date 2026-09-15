import { apiError, apiJson, readJson } from "@/lib/api";
import { requireWorkspaceRole } from "@/lib/auth";
import { randomToken, sha256 } from "@/lib/security";
import { getAdminClient } from "@/lib/supabase/admin";
import { agentRegistrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = agentRegistrationSchema.parse(await readJson(request));
    const { user } = await requireWorkspaceRole(input.workspaceId, ["owner", "admin"]);
    const admin = getAdminClient();
    const token = randomToken(32);
    const { data: agent, error } = await admin
      .from("agents")
      .insert({
        workspace_id: input.workspaceId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        capabilities: input.capabilities,
        runtime_type: input.runtimeType,
        runtime_version: input.runtimeVersion ?? null,
        version: input.version ?? null,
        metadata: input.metadata,
        icon_url: input.iconUrl ?? null,
        max_concurrency: input.maxConcurrency,
        status: "offline",
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return apiJson(
          { error: { code: "slug_conflict", message: "An agent with this slug already exists." } },
          { status: 409 },
        );
      }
      throw error;
    }
    const { error: tokenError } = await admin.from("agent_tokens").insert({
      agent_id: agent.id,
      token_hash: sha256(token),
      token_prefix: token.slice(0, 8),
      label: "initial",
      created_by: user.id,
    });
    if (tokenError) {
      await admin.from("agents").delete().eq("id", agent.id);
      throw tokenError;
    }
    await admin.from("agent_events").insert({
      workspace_id: input.workspaceId,
      agent_id: agent.id,
      event_id: `registered-${crypto.randomUUID()}`,
      type: "agent_registered",
      message: `${input.name} was registered from Agent HQ.`,
      payload: { runtimeType: input.runtimeType },
      occurred_at: new Date().toISOString(),
    });
    return apiJson(
      {
        agent,
        token,
        warning: "This token is shown once. Store it securely; Agent HQ cannot recover it.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
