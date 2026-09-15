import { z } from "zod";
import { EVENT_TYPES } from "@/lib/types";
import {
  DEFAULT_LEASE_SECONDS,
  MAX_EVENT_MESSAGE_LENGTH,
  MAX_LEASE_SECONDS,
} from "@/lib/constants";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const agentRegistrationSchema = z.object({
  workspaceId: z.uuid(),
  slug,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  capabilities: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  runtimeType: z.string().trim().min(1).max(80).default("custom"),
  runtimeVersion: z.string().trim().max(80).nullable().optional(),
  version: z.string().trim().max(80).nullable().optional(),
  iconUrl: z.url().max(2_000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  maxConcurrency: z.number().int().min(1).max(50).default(1),
});

export const eventSchema = z
  .object({
    eventId: z.string().trim().min(8).max(128),
    type: z.enum(EVENT_TYPES),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    taskExternalId: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    message: z.string().max(MAX_EVENT_MESSAGE_LENGTH).optional(),
    progress: z.number().finite().min(0).max(100).nullable().optional(),
    error: z.string().max(MAX_EVENT_MESSAGE_LENGTH).optional(),
    level: z.enum(["debug", "info", "warn", "error"]).optional(),
    runtimeVersion: z.string().trim().max(80).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    artifact: z
      .object({
        name: z.string().trim().min(1).max(255),
        kind: z.string().trim().min(1).max(80).default("file"),
        url: z.url().max(2_000).optional(),
        storagePath: z.string().trim().max(1_000).optional(),
        mimeType: z.string().trim().max(150).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
        checksum: z.string().trim().max(128).optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    const taskTypes = new Set([
      "task_started",
      "progress",
      "current_step",
      "task_completed",
      "task_failed",
      "task_cancelled",
      "artifact_produced",
    ]);
    if (taskTypes.has(value.type) && !value.taskExternalId) {
      context.addIssue({
        code: "custom",
        path: ["taskExternalId"],
        message: "Required for this event type.",
      });
    }
    if (value.type === "task_started" && !value.title) {
      context.addIssue({ code: "custom", path: ["title"], message: "Required for task_started." });
    }
    if (value.type === "progress" && value.progress == null) {
      context.addIssue({
        code: "custom",
        path: ["progress"],
        message: "Required for progress events.",
      });
    }
    if (value.type === "artifact_produced" && !value.artifact) {
      context.addIssue({
        code: "custom",
        path: ["artifact"],
        message: "Required for artifact events.",
      });
    }
  });

export const createTaskSchema = z.object({
  workspaceId: z.uuid(),
  agentId: z.uuid(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).nullable().optional(),
  priority: z.number().int().min(-100).max(100).default(0),
  scheduledFor: z.iso.datetime({ offset: true }).nullable().optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const claimTaskSchema = z.object({
  workerId: z.uuid(),
  leaseSeconds: z.number().int().min(15).max(MAX_LEASE_SECONDS).default(DEFAULT_LEASE_SECONDS),
});

export const taskActionSchema = z.object({
  action: z.enum(["acknowledge", "start", "heartbeat", "paused", "complete", "fail", "cancelled"]),
  leaseId: z.uuid(),
  message: z.string().max(MAX_EVENT_MESSAGE_LENGTH).optional(),
  error: z.string().max(MAX_EVENT_MESSAGE_LENGTH).optional(),
  progress: z.number().finite().min(0).max(100).nullable().optional(),
});

export const dashboardTaskActionSchema = z.object({
  action: z.enum(["cancel", "retry", "pause", "resume"]),
});

export const workerRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  runtimeType: z.string().trim().min(1).max(80),
  runtimeVersion: z.string().trim().min(1).max(80),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
