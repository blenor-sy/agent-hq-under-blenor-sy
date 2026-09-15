import { ApiError, apiError, apiJson, bearerToken } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/security";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const configured = process.env.CRON_SECRET;
    if (!configured) throw new ApiError(503, "not_configured", "Maintenance is not configured.");
    const supplied = bearerToken(request);
    const expectedHash = Buffer.from(sha256(configured));
    const suppliedHash = Buffer.from(sha256(supplied));
    if (!crypto.timingSafeEqual(expectedHash, suppliedHash)) {
      throw new ApiError(401, "invalid_token", "Maintenance token is invalid.");
    }
    const admin = getAdminClient();
    const [agents, leases, schedules] = await Promise.all([
      admin.rpc("mark_stale_agents"),
      admin.rpc("release_expired_task_leases"),
      admin.rpc("enqueue_due_schedules"),
    ]);
    if (agents.error) throw agents.error;
    if (leases.error) throw leases.error;
    if (schedules.error) throw schedules.error;
    return apiJson({
      ok: true,
      agentsMarkedOffline: agents.data,
      leasesReleased: leases.data,
      schedulesQueued: schedules.data,
    });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = POST;
