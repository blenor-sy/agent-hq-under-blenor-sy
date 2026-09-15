import { describe, expect, it } from "vitest";
import { ApiError, bearerToken, readJson } from "@/lib/api";

describe("HTTP input handling", () => {
  it("rejects non-JSON bodies", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "text" });
    await expect(readJson(request)).rejects.toMatchObject({ status: 415 });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    await expect(readJson(request)).rejects.toMatchObject({ status: 400, code: "invalid_json" });
  });

  it("requires a sufficiently long bearer token", () => {
    expect(() => bearerToken(new Request("http://localhost"))).toThrow(ApiError);
    expect(() =>
      bearerToken(new Request("http://localhost", { headers: { authorization: "Bearer short" } })),
    ).toThrow(/invalid/i);
  });
});
