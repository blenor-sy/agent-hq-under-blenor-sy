import { describe, expect, it } from "vitest";
import { identityFromClaims, isSupabaseAuthCookie } from "@/lib/supabase/session";

describe("Supabase session helpers", () => {
  it("recognizes auth cookie chunks and code verifier cookies", () => {
    expect(isSupabaseAuthCookie("sb-project-auth-token")).toBe(true);
    expect(isSupabaseAuthCookie("sb-project-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookie("sb-project-auth-token-code-verifier")).toBe(true);
    expect(isSupabaseAuthCookie("theme")).toBe(false);
  });

  it("accepts only claims with a subject", () => {
    expect(identityFromClaims({ sub: "user-id", email: "owner@example.com" })).toEqual({
      id: "user-id",
      email: "owner@example.com",
    });
    expect(identityFromClaims({ email: "owner@example.com" })).toBeNull();
  });
});
