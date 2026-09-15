import { describe, expect, it } from "vitest";
import { randomToken, sha256 } from "@/lib/security";

describe("agent credentials", () => {
  it("creates high-entropy tokens and stores deterministic hashes", () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(sha256(first)).toHaveLength(64);
    expect(sha256(first)).toBe(sha256(first));
  });
});
