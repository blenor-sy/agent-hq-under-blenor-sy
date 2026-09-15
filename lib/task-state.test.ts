import { describe, expect, it } from "vitest";
import { assertTaskTransition, canTransitionTask, isTerminalTaskStatus } from "@/lib/task-state";

describe("task state transitions", () => {
  it("allows the normal queue lifecycle", () => {
    expect(canTransitionTask("queued", "claimed")).toBe(true);
    expect(canTransitionTask("claimed", "running")).toBe(true);
    expect(canTransitionTask("running", "completed")).toBe(true);
  });

  it("rejects terminal-state regression", () => {
    expect(canTransitionTask("completed", "running")).toBe(false);
    expect(() => assertTaskTransition("completed", "running")).toThrow(/Invalid task transition/);
  });

  it("allows an explicit failed-task retry and detects terminal states", () => {
    expect(canTransitionTask("failed", "queued")).toBe(true);
    expect(isTerminalTaskStatus("failed")).toBe(true);
    expect(isTerminalTaskStatus("running")).toBe(false);
  });
});
