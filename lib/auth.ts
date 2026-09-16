import { ApiError, bearerToken } from "@/lib/api";
import { sha256 } from "@/lib/security";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";
import { identityFromClaims } from "@/lib/supabase/session";

export async function requireUser() {
  const supabase = await getServerClient();
  if (!supabase) throw new ApiError(503, "not_configured", "Agent HQ is not configured.");
  const { data, error } = await supabase.auth.getClaims();
  const user = identityFromClaims(data?.claims);
  if (error || !user) throw new ApiError(401, "authentication_required", "Sign in is required.");
  return { supabase, user };
}

export async function requireWorkspaceRole(workspaceId: string, roles?: string[]) {
  const context = await requireUser();
  const { data, error } = await context.supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error || !data || (roles && !roles.includes(String(data.role)))) {
    throw new ApiError(403, "forbidden", "You do not have access to this workspace.");
  }
  return { ...context, role: String(data.role) };
}

export async function authenticateAgent(request: Request) {
  const token = bearerToken(request);
  const tokenHash = sha256(token);
  const admin = getAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("agent_tokens")
    .select("id, agent_id, revoked_at, expires_at, agents!inner(id, workspace_id, deleted_at)")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();
  const joinedAgent = Array.isArray(data?.agents) ? data.agents[0] : data?.agents;
  if (error || !data || !joinedAgent || joinedAgent.deleted_at) {
    throw new ApiError(401, "invalid_token", "The agent token is invalid or revoked.");
  }
  await admin.from("agent_tokens").update({ last_used_at: now }).eq("id", data.id);
  return {
    admin,
    tokenId: String(data.id),
    agentId: String(data.agent_id),
    workspaceId: String(joinedAgent.workspace_id),
    tokenHash,
  };
}

export async function enforceAgentRateLimit(
  admin: ReturnType<typeof getAdminClient>,
  tokenHash: string,
  bucket: string,
  limit: number,
) {
  const { data, error } = await admin.rpc("check_api_rate_limit", {
    requested_key_hash: tokenHash,
    requested_bucket: bucket,
    requested_limit: limit,
    requested_window_seconds: 60,
  });
  if (error) throw error;
  if (!data) throw new ApiError(429, "rate_limited", "Too many requests. Retry shortly.");
}
