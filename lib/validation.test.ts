import { describe, expect, it } from "vitest";
import { agentRegistrationSchema, createTaskSchema, eventSchema } from "@/lib/validation";

describe("agent API validation", () => {
  it("accepts truthful progress omission", () => {
    const result = eventSchema.parse({
      eventId: "event-0001",
      type: "heartbeat",
      message: "Still working",
    });
    expect(result.progress).toBeUndefined();
  });

  it("requires a task ID and measurable value for progress", () => {
    expect(() => eventSchema.parse({ eventId: "event-0002", type: "progress" })).toThrow();
    expect(() =>
      eventSchema.parse({
        eventId: "event-0003",
        type: "progress",
        taskExternalId: "task-1",
        progress: 101,
      }),
    ).toThrow();
  });

  it("rejects malformed agent registrations", () => {
    expect(() =>
      agentRegistrationSchema.parse({
        workspaceId: "not-a-uuid",
        slug: "Unsafe Slug",
        name: "",
      }),
    ).toThrow();
  });

  it("bounds task control inputs", () => {
    expect(() =>
      createTaskSchema.parse({
        workspaceId: crypto.randomUUID(),
        agentId: crypto.randomUUID(),
        title: "Task",
        maxAttempts: 100,
      }),
    ).toThrow();
  });
});
