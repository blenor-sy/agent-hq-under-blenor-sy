import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/lib/supabase/env";

export async function getServerClient() {
  const environment = getPublicEnvironment();
  if (!environment) return null;
  const cookieStore = await cookies();
  return createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. proxy.ts performs refreshes.
        }
      },
    },
  });
}
