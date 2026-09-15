import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/lib/supabase/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  const environment = getPublicEnvironment();
  if (!environment) return null;
  client ??= createBrowserClient(environment.url, environment.publishableKey);
  return client;
}
