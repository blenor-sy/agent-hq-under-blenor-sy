import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256 } from "@/lib/security";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.AGENT_ADMIN_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const slug = String(body.slug ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!slug || !name) return NextResponse.json({ error: "slug and name are required" }, { status: 400 });

  const supabase = getAdminClient();
  const token = randomToken();
  const { data: agent, error } = await supabase.from("agents").upsert({
    slug,
    name,
    description: body.description ?? null,
    capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
    status: "idle",
    updated_at: new Date().toISOString()
  }, { onConflict: "slug" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: tokenError } = await supabase.from("agent_tokens").insert({ agent_id: agent.id, token_hash: sha256(token) });
  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 });

  return NextResponse.json({ agent, token, warning: "This token is shown once. Store it securely." });
}
