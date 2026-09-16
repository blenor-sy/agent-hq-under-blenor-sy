export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export function identityFromClaims(claims: Record<string, unknown> | undefined) {
  const id = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  return id ? { id, email } : null;
}
