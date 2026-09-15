import { describe, expect, it } from "vitest";
import { durationMs, formatDuration, getAgentHealth, relativeTime } from "@/lib/time";

describe("task timing", () => {
  it("calculates running and finished durations from timestamps", () => {
    expect(durationMs("2026-01-01T00:00:00Z", "2026-01-01T01:02:03Z")).toBe(3_723_000);
    expect(formatDuration(3_723_000)).toBe("1h 2m");
  });

  it("never returns a negative duration for clock skew", () => {
    expect(durationMs("2026-01-01T00:00:10Z", "2026-01-01T00:00:00Z")).toBe(0);
  });

  it("handles missing and malformed timestamps", () => {
    expect(durationMs(null)).toBeNull();
    expect(durationMs("not-a-date")).toBeNull();
    expect(formatDuration(null)).toBe("Unavailable");
  });

  it("formats relative timestamps", () => {
    const now = new Date("2026-01-01T00:10:00Z").getTime();
    expect(relativeTime("2026-01-01T00:09:20Z", now)).toBe("40s ago");
    expect(relativeTime(null, now)).toBe("Never");
  });
});

describe("heartbeat health", () => {
  const now = new Date("2026-01-01T00:10:00Z").getTime();

  it.each([
    [null, "never_seen"],
    ["2026-01-01T00:09:45Z", "live"],
    ["2026-01-01T00:08:00Z", "stale"],
    ["2026-01-01T00:04:00Z", "offline"],
  ] as const)("maps %s to %s", (timestamp, expected) => {
    expect(getAgentHealth(timestamp, now)).toBe(expected);
  });
});
