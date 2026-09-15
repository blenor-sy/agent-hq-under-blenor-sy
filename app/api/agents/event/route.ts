import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/security";

const allowed = new Set(["heartbeat", "task_started", "progress", "log", "task_completed", "task_failed", "idle"]);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const supabase = getAdminClient();
  const { data: tokenRow } = await supabase.from("agent_tokens").select("agent_id, revoked_at").eq("token_hash", sha256(token)).is("revoked_at", null).maybeSingle();
  if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await req.json();
  const type = String(body.type ?? "");
  if (!allowed.has(type)) return NextResponse.json({ error: "Invalid event type" }, { status: 400 });

  const now = new Date().toISOString();
  let taskId: string | null = null;

  if (body.taskExternalId) {
    const externalId = String(body.taskExternalId);
    if (type === "task_started") {
      const { data: task, error } = await supabase.from("tasks").upsert({
        agent_id: tokenRow.agent_id,
        external_id: externalId,
        title: String(body.title ?? "Untitled task"),
        status: "running",
        progress: Number(body.progress ?? 0),
        current_step: body.message ?? null,
        started_at: now,
        finished_at: null,
        updated_at: now
      }, { onConflict: "agent_id,external_id" }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      taskId = task.id;
    } else {
      const { data: task } = await supabase.from("tasks").select("id").eq("agent_id", tokenRow.agent_id).eq("external_id", externalId).maybeSingle();
      taskId = task?.id ?? null;
    }
  }

  if (taskId && ["heartbeat", "progress", "log"].includes(type)) {
    const update: Record<string, unknown> = { updated_at: now };
    if (body.progress != null) update.progress = Math.max(0, Math.min(100, Number(body.progress)));
    if (body.message != null) update.current_step = body.message;
    await supabase.from("tasks").update(update).eq("id", taskId);
  }

  if (taskId && type === "task_completed") {
    await supabase.from("tasks").update({ status: "completed", progress: 100, current_step: body.message ?? "Completed", finished_at: now, updated_at: now }).eq("id", taskId);
  }
  if (taskId && type === "task_failed") {
    await supabase.from("tasks").update({ status: "failed", current_step: body.message ?? "Failed", error_message: body.error ?? body.message ?? "Unknown error", finished_at: now, updated_at: now }).eq("id", taskId);
  }

  const agentStatus = ["task_started", "progress", "heartbeat", "log"].includes(type) ? "working" : type === "task_failed" ? "error" : "idle";
  await supabase.from("agents").update({ status: agentStatus, last_seen_at: now, updated_at: now }).eq("id", tokenRow.agent_id);

  const { error: eventError } = await supabase.from("agent_events").insert({ agent_id: tokenRow.agent_id, task_id: taskId, type, message: body.message ?? null, payload: body, created_at: now });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  return NextResponse.json({ ok: true, receivedAt: now });
}
