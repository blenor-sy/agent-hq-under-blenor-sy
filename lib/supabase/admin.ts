import { createClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/lib/supabase/env";

export function getAdminClient() {
  const environment = getServerEnvironment();
  return createClient(environment.url, environment.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "agent-hq-server/1.0" } },
  });
}
