import { apiError, apiJson, readJson } from "@/lib/api";
import { requireWorkspaceRole } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  workspaceId: z.uuid(),
  agentId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  intervalMinutes: z.number().int().min(5).max(525_600),
  nextRunAt: z.iso.datetime({ offset: true }),
  task: z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10_000).optional(),
    priority: z.number().int().min(-100).max(100).default(0),
    maxAttempts: z.number().int().min(1).max(10).default(3),
  }),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const { supabase } = await requireWorkspaceRole(input.workspaceId, [
      "owner",
      "admin",
      "member",
    ]);
    const { data, error } = await supabase.rpc("create_interval_schedule", {
      requested_workspace_id: input.workspaceId,
      requested_agent_id: input.agentId,
      requested_name: input.name,
      requested_interval_seconds: input.intervalMinutes * 60,
      requested_next_run_at: input.nextRunAt,
      requested_task_template: input.task,
    });
    if (error) throw error;
    return apiJson({ schedule: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
