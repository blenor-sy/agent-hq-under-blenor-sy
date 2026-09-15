export type AgentEventType = "heartbeat" | "task_started" | "progress" | "log" | "task_completed" | "task_failed" | "idle";

export class AgentHQClient {
  constructor(private baseUrl: string, private token: string) {}

  async event(input: { type: AgentEventType; taskExternalId?: string; title?: string; message?: string; progress?: number; error?: string; [key: string]: unknown; }) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/agents/event`, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${this.token}` },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error(`Agent HQ event failed: ${response.status} ${await response.text()}`);
    return response.json();
  }

  startTask(id: string, title: string, message = "Starting") { return this.event({ type: "task_started", taskExternalId: id, title, message, progress: 0 }); }
  progress(id: string, progress: number, message: string) { return this.event({ type: "progress", taskExternalId: id, progress, message }); }
  heartbeat(id: string, message?: string, progress?: number) { return this.event({ type: "heartbeat", taskExternalId: id, message, progress }); }
  complete(id: string, message = "Completed") { return this.event({ type: "task_completed", taskExternalId: id, message, progress: 100 }); }
  fail(id: string, error: string) { return this.event({ type: "task_failed", taskExternalId: id, message: error, error }); }
}
