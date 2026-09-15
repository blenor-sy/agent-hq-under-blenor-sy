export type AgentEventType =
  | "online"
  | "offline"
  | "heartbeat"
  | "task_started"
  | "progress"
  | "current_step"
  | "log"
  | "artifact_produced"
  | "task_completed"
  | "task_failed"
  | "task_cancelled"
  | "idle";

export interface AgentEvent {
  eventId?: string;
  type: AgentEventType;
  occurredAt?: string;
  taskExternalId?: string;
  title?: string;
  message?: string;
  progress?: number | null;
  error?: string;
  level?: "debug" | "info" | "warn" | "error";
  runtimeVersion?: string;
  metadata?: Record<string, unknown>;
  artifact?: {
    name: string;
    kind?: string;
    url?: string;
    storagePath?: string;
    mimeType?: string;
    sizeBytes?: number;
    checksum?: string;
  };
}

export interface ClaimedTask {
  id: string;
  title: string;
  description: string | null;
  input: Record<string, unknown>;
  priority: number;
  lease_id: string;
  lease_expires_at: string;
  attempt_count: number;
}

export class AgentHQClient {
  private readonly baseUrl: string;
  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly options: { retries?: number; timeoutMs?: number } = {},
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request(path: string, init: RequestInit, idempotencyKey?: string) {
    const attempts = Math.max(1, (this.options.retries ?? 3) + 1);
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.token}`,
            ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
            ...init.headers,
          },
        });
        if (response.status === 204) return null;
        const body = await response.json().catch(() => null);
        if (response.ok) return body;
        if (response.status < 500 && response.status !== 429) {
          throw new Error(
            body?.error?.message ?? `Agent HQ rejected the request (${response.status}).`,
          );
        }
        lastError = new Error(`Agent HQ is temporarily unavailable (${response.status}).`);
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < attempts - 1)
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
    throw lastError instanceof Error ? lastError : new Error("Agent HQ request failed.");
  }

  async event(input: AgentEvent) {
    const eventId = input.eventId ?? crypto.randomUUID();
    return this.request(
      "/api/v1/events",
      { method: "POST", body: JSON.stringify({ ...input, eventId }) },
      eventId,
    );
  }

  registerWorker(input: {
    name: string;
    runtimeType: string;
    runtimeVersion: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request("/api/v1/workers/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async claimTask(workerId: string, leaseSeconds = 60): Promise<ClaimedTask | null> {
    const body = await this.request("/api/v1/tasks/claim", {
      method: "POST",
      body: JSON.stringify({ workerId, leaseSeconds }),
    });
    return body?.task ?? null;
  }

  updateTask(
    workerId: string,
    taskId: string,
    leaseId: string,
    action: "acknowledge" | "start" | "heartbeat" | "paused" | "complete" | "fail" | "cancelled",
    details: { message?: string; error?: string; progress?: number | null } = {},
  ) {
    return this.request(`/api/v1/tasks/${taskId}/worker`, {
      method: "PATCH",
      headers: { "agent-hq-worker-id": workerId },
      body: JSON.stringify({ action, leaseId, ...details }),
    });
  }

  startTask(id: string, title: string, message = "Starting") {
    return this.event({ type: "task_started", taskExternalId: id, title, message });
  }
  progress(id: string, progress: number, message: string) {
    return this.event({ type: "progress", taskExternalId: id, progress, message });
  }
  heartbeat(id?: string, message?: string, progress?: number) {
    return this.event({
      type: "heartbeat",
      ...(id === undefined ? {} : { taskExternalId: id }),
      ...(message === undefined ? {} : { message }),
      ...(progress === undefined ? {} : { progress }),
    });
  }
  complete(id: string, message = "Completed", progress?: number) {
    return this.event({
      type: "task_completed",
      taskExternalId: id,
      message,
      ...(progress === undefined ? {} : { progress }),
    });
  }
  fail(id: string, error: string) {
    return this.event({
      type: "task_failed",
      taskExternalId: id,
      message: error,
      error,
      level: "error",
    });
  }
}
