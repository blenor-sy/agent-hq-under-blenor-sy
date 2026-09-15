/**
 * Safe, persistent Agent HQ worker adapter.
 * It never evaluates task input or executes shell commands. Work is delegated to an explicitly
 * configured HTTPS handler and every state change is acknowledged through a database lease.
 */

const required = ["AGENT_HQ_URL", "AGENT_HQ_TOKEN", "AGENT_HANDLER_URL"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const baseUrl = process.env.AGENT_HQ_URL.replace(/\/$/, "");
const token = process.env.AGENT_HQ_TOKEN;
const handlerUrl = new URL(process.env.AGENT_HANDLER_URL);
if (handlerUrl.protocol !== "https:" && handlerUrl.hostname !== "localhost") {
  throw new Error("AGENT_HANDLER_URL must use HTTPS (localhost is allowed for development). ");
}
const workerName = process.env.WORKER_NAME || `worker-${process.pid}`;
const pollMs = Math.max(1_000, Number(process.env.POLL_INTERVAL_MS || 5_000));

async function hq(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || `Agent HQ returned ${response.status}`);
  return body;
}

const registration = await hq("/api/v1/workers/register", {
  method: "POST",
  body: JSON.stringify({
    name: workerName,
    runtimeType: "webhook-adapter",
    runtimeVersion: "1.0.0",
    metadata: { node: process.version },
  }),
});
const workerId = registration.worker.id;
console.log(`Agent HQ worker ${workerName} registered.`);

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

while (!stopping) {
  try {
    const claim = await hq("/api/v1/tasks/claim", {
      method: "POST",
      body: JSON.stringify({ workerId, leaseSeconds: 60 }),
    });
    const task = claim?.task;
    if (!task) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const headers = { "agent-hq-worker-id": workerId };
    const update = (action, details = {}) =>
      hq(`/api/v1/tasks/${task.id}/worker`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action, leaseId: task.lease_id, ...details }),
      });
    await update("acknowledge");
    await update("start", { message: "Work accepted by persistent handler" });
    const handlerController = new AbortController();
    let cancellationRequested = false;
    const heartbeat = setInterval(() => {
      void update("heartbeat", { message: "Handler is still working" })
        .then((body) => {
          if (body?.task?.status === "cancel_requested") {
            cancellationRequested = true;
            handlerController.abort();
          }
        })
        .catch(console.error);
    }, 30_000);
    try {
      const result = await fetch(handlerUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: handlerController.signal,
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description,
          input: task.input,
          attempt: task.attempt_count,
        }),
      });
      if (!result.ok) throw new Error(`Handler returned ${result.status}`);
      const output = await result.json().catch(() => ({}));
      await update("complete", {
        message: output.message || "Handler completed the task",
        ...(Number.isFinite(output.progress) ? { progress: output.progress } : {}),
      });
    } catch (error) {
      if (cancellationRequested)
        await update("cancelled", { message: "Cancellation acknowledged" });
      else
        await update("fail", { error: error instanceof Error ? error.message : "Handler failed" });
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    console.error(new Date().toISOString(), error instanceof Error ? error.message : error);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
