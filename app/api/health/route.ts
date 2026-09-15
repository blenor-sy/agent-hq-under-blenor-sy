import { apiJson } from "@/lib/api";
import { getPublicEnvironment } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export function GET() {
  return apiJson({
    status: "ok",
    service: "agent-hq-dashboard-api",
    databaseConfigured: Boolean(getPublicEnvironment()),
    checkedAt: new Date().toISOString(),
  });
}
