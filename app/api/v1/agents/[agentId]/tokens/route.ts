import { ApiError, apiError, apiJson, readJson } from "@/lib/api";
import { requireWorkspaceRole } from "@/lib/auth";
import { randomToken, sha256 } from "@/lib/security";
import { getAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

async function authorizeAgent(agentId: string) {
  const admin = getAdminClient();
  const { data: agent, error } = await admin
    .from("agents")
    .select("id,workspace_id")
    .eq("id", agentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !agent) throw new ApiError(404, "agent_not_found", "Agent not found.");
  const context = await requireWorkspaceRole(agent.workspace_id, ["owner", "admin"]);
  return { admin, agent, ...context };
}

export async function GET(_request: Request, context: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await context.params;
    const { admin } = await authorizeAgent(agentId);
    const { data, error } = await admin
      .from("agent_tokens")
      .select("id,label,token_prefix,created_at,last_used_at,expires_at,revoked_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiJson({ tokens: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await context.params;
    const input = z
      .object({ label: z.string().trim().min(1).max(80).default("rotated") })
      .parse(await readJson(request));
    const { admin, user } = await authorizeAgent(agentId);
    const token = randomToken();
    const { data, error } = await admin
      .from("agent_tokens")
      .insert({
        agent_id: agentId,
        token_hash: sha256(token),
        token_prefix: token.slice(0, 8),
        label: input.label,
        created_by: user.id,
      })
      .select("id,label,token_prefix,created_at")
      .single();
    if (error) throw error;
    return apiJson(
      { token, credential: data, warning: "This token is shown once." },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await context.params;
    const input = z.object({ tokenId: z.uuid() }).parse(await readJson(request));
    const { admin } = await authorizeAgent(agentId);
    const { data, error } = await admin
      .from("agent_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("agent_id", agentId)
      .eq("id", input.tokenId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "credential_not_found", "Active credential not found.");
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
