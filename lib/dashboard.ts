import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export async function getDashboardContext() {
  const supabase = await getServerClient();
  if (!supabase) redirect("/");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,workspaces!inner(id,name)")
    .eq("user_id", auth.user.id)
    .limit(1);
  if (error) throw error;
  const membership = memberships?.[0];
  if (!membership) {
    throw new Error(
      "Your account does not have an Agent HQ workspace. Apply all database migrations.",
    );
  }
  const workspaceRelation = Array.isArray(membership.workspaces)
    ? membership.workspaces[0]
    : membership.workspaces;
  if (!workspaceRelation) throw new Error("Workspace record is unavailable.");
  return {
    supabase,
    user: auth.user,
    workspace: { id: String(workspaceRelation.id), name: String(workspaceRelation.name) },
    role: String(membership.role),
  };
}
