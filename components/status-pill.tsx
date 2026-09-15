import type { AgentHealth, AgentStatus, TaskStatus } from "@/lib/types";

export function StatusPill({ value }: { value: AgentHealth | AgentStatus | TaskStatus | string }) {
  return (
    <span className={`status-pill status-${value.replaceAll("_", "-")}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
