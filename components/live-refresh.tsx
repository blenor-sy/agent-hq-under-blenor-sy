"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

const tables = [
  "agents",
  "tasks",
  "agent_events",
  "workers",
  "task_attempts",
  "artifacts",
  "notifications",
];

const RETRY_DELAY_MS = 5_000;
const FALLBACK_REFRESH_MS = 30_000;

export function LiveRefresh({
  workspaceId,
  surface,
}: {
  workspaceId: string;
  surface: "sidebar" | "mobile";
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<"connecting" | "live" | "delayed">("connecting");

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    let stopped = false;
    let isLive = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (stopped || channel) return;
      setState("connecting");
      // Both responsive navigation surfaces remain mounted in the DOM. Their
      // topics must be unique because Supabase rejects duplicate subscriptions.
      let nextChannel = supabase.channel(`agent-hq:${workspaceId}:${surface}`);
      tables.forEach((table) => {
        nextChannel = nextChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` },
          refresh,
        );
      });
      channel = nextChannel;
      nextChannel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          isLive = true;
          setState("live");
          return;
        }
        if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT" && status !== "CLOSED") return;
        isLive = false;
        setState("delayed");
        const failedChannel = channel;
        channel = null;
        if (failedChannel) void supabase.removeChannel(failedChannel);
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, RETRY_DELAY_MS);
      });
    };

    const sync = () => {
      refresh();
      if (!channel) connect();
    };
    connect();
    const fallbackTimer = setInterval(() => {
      if (!isLive) router.refresh();
    }, FALLBACK_REFRESH_MS);
    window.addEventListener("online", sync);
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(fallbackTimer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", refresh);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, surface, workspaceId]);

  return (
    <span
      className={`connection ${state}`}
      title={
        state === "live"
          ? "Live updates connected"
          : "Live updates are reconnecting; saved dashboard data remains available"
      }
    >
      {state === "live" ? <Wifi size={14} /> : <WifiOff size={14} />}
      {state === "live" ? "Live" : state === "connecting" ? "Connecting" : "Sync delayed"}
    </span>
  );
}
