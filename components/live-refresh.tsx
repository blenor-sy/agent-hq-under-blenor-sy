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

export function LiveRefresh({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<"connecting" | "live" | "reconnecting">("connecting");

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    let channel = supabase.channel(`agent-hq:${workspaceId}`);
    tables.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` },
        refresh,
      );
    });
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") setState("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setState("reconnecting");
      }
    });
    const sync = () => {
      setState("reconnecting");
      router.refresh();
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", refresh);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [router, workspaceId]);

  return (
    <span className={`connection ${state}`} title="Realtime connection status">
      {state === "live" ? <Wifi size={14} /> : <WifiOff size={14} />}
      {state === "live" ? "Live" : state === "connecting" ? "Connecting" : "Reconnecting"}
    </span>
  );
}
