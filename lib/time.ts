import { HEARTBEAT_OFFLINE_AFTER_MS, HEARTBEAT_STALE_AFTER_MS } from "@/lib/constants";
import type { AgentHealth } from "@/lib/types";

export function durationMs(
  start: string | Date | null,
  end: string | Date | null = null,
): number | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, endMs - startMs);
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return "Unavailable";
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (totalMinutes > 0) return `${totalMinutes}m ${seconds}s`;
  return `${totalSeconds}s`;
}

export function getAgentHealth(
  lastSeenAt: string | Date | null,
  now = Date.now(),
  staleAfterMs = HEARTBEAT_STALE_AFTER_MS,
  offlineAfterMs = HEARTBEAT_OFFLINE_AFTER_MS,
): AgentHealth {
  if (!lastSeenAt) return "never_seen";
  const seenAt = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seenAt)) return "offline";
  const age = Math.max(0, now - seenAt);
  if (age > offlineAfterMs) return "offline";
  if (age > staleAfterMs) return "stale";
  return "live";
}

export function relativeTime(value: string | Date | null, now = Date.now()): string {
  if (!value) return "Never";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
