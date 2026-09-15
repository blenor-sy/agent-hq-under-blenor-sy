export function getPublicEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getServerEnvironment() {
  const publicEnvironment = getPublicEnvironment();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!publicEnvironment || !secretKey) {
    throw new Error(
      "Agent HQ is not configured. Set NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.",
    );
  }
  return { ...publicEnvironment, secretKey };
}

export function isSupabaseConfigured() {
  return Boolean(getPublicEnvironment());
}
