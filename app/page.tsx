"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

type Agent = { id: string; slug: string; name: string; description: string | null; status: "idle" | "working" | "error" | "offline"; last_seen_at: string | null; };
type Task = { id: string; agent_id: string; title: string; status: string; progress: number; current_step: string | null; started_at: string | null; finished_at: string | null; };
type EventRow = { id: string; agent_id: string; type: string; message: string | null; created_at: string; };

function duration(start: string | null, end?: string | null) {
  if (!start) return "—";
  const seconds = Math.max(0, Math.floor(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function lastSeen(value: string | null) {
  if (!value) return "never";
  const sec = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function Home() {
  const supabase = useMemo(() => getBrowserClient(), []);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [a, t, e] = await Promise.all([
      supabase.from("agents").select("*").order("name"),
      supabase.from("tasks").select("*").order("started_at", { ascending: false }).limit(100),
      supabase.from("agent_events").select("id,agent_id,type,message,created_at").order("created_at", { ascending: false }).limit(40)
    ]);
    setAgents((a.data ?? []) as Agent[]);
    setTasks((t.data ?? []) as Task[]);
    setEvents((e.data ?? []) as EventRow[]);
  }, [supabase]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const channel = supabase.channel("agent-hq-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  useEffect(() => {
    const id = setInterval(() => tick(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeTask = (agentId: string) => tasks.find(t => t.agent_id === agentId && t.status === "running");
  const working = agents.filter(a => activeTask(a.id)).length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const failed = tasks.filter(t => t.status === "failed").length;

  if (!supabase) return <main style={{ maxWidth: 900, margin: "70px auto", padding: 24 }}><h1>Agent HQ</h1><p style={{ color: "var(--muted)" }}>Supabase is not configured yet. Add the environment variables from <code>.env.example</code>.</p></main>;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 20px 80px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "end", flexWrap: "wrap" }}>
        <div><div style={{ color: "var(--accent)", fontWeight: 700, letterSpacing: 1 }}>CONTROL ROOM</div><h1 style={{ fontSize: 38, margin: "5px 0 4px" }}>Agent HQ</h1><div style={{ color: "var(--muted)" }}>Live status across every connected agent.</div></div>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>Realtime dashboard</div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginTop: 28 }}>
        {[["Agents", agents.length], ["Working", working], ["Completed", completed], ["Failed", failed]].map(([label, value]) => <div key={String(label)} style={card}><div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div><div style={{ fontSize: 30, fontWeight: 750, marginTop: 4 }}>{value}</div></div>)}
      </section>

      <h2 style={{ marginTop: 34 }}>Agents</h2>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        {agents.map(agent => {
          const task = activeTask(agent.id);
          const stale = !agent.last_seen_at || Date.now() - new Date(agent.last_seen_at).getTime() > 90000;
          const state = stale ? "offline" : task ? "working" : agent.status;
          return <article key={agent.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><div style={{ fontWeight: 750, fontSize: 18 }}>{agent.name}</div><div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{agent.description || agent.slug}</div></div><Status value={state} /></div>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 15 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>CURRENT TASK</div><div style={{ fontWeight: 650, marginTop: 5 }}>{task?.title ?? "No active task"}</div><div style={{ color: "var(--muted)", fontSize: 13, minHeight: 20, marginTop: 5 }}>{task?.current_step ?? (state === "offline" ? "Agent is not sending heartbeats" : "Ready")}</div>
            {task && <><div style={{ height: 8, background: "#222b3d", borderRadius: 99, overflow: "hidden", marginTop: 14 }}><div style={{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%`, height: "100%", background: "var(--accent)" }} /></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--muted)" }}><span>{task.progress ?? 0}%</span><span>Running {duration(task.started_at)}</span></div></>}
            <div style={{ marginTop: 13, fontSize: 12, color: "var(--muted)" }}>Last heartbeat: {lastSeen(agent.last_seen_at)}</div></div>
          </article>;
        })}
        {agents.length === 0 && <div style={{ color: "var(--muted)" }}>No agents registered yet.</div>}
      </section>

      <h2 style={{ marginTop: 34 }}>Recent activity</h2>
      <section style={{ ...card, padding: 0, overflow: "hidden" }}>
        {events.length === 0 ? <div style={{ padding: 18, color: "var(--muted)" }}>No events yet.</div> : events.map((event, i) => {
          const agent = agents.find(a => a.id === event.agent_id);
          return <div key={event.id} style={{ padding: "13px 16px", borderTop: i ? "1px solid var(--border)" : "none", display: "grid", gridTemplateColumns: "150px 120px 1fr", gap: 12, fontSize: 13 }}><span>{agent?.name ?? "Agent"}</span><span style={{ color: "var(--accent)" }}>{event.type}</span><span style={{ color: "var(--muted)" }}>{event.message ?? new Date(event.created_at).toLocaleString()}</span></div>;
        })}
      </section>
    </main>
  );
}

function Status({ value }: { value: string }) {
  const color = value === "working" ? "var(--green)" : value === "error" ? "var(--red)" : value === "offline" ? "var(--yellow)" : "var(--muted)";
  return <span style={{ border: `1px solid ${color}`, color, borderRadius: 999, height: 28, padding: "5px 9px", fontSize: 12 }}>{value}</span>;
}

const card: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--panel)", borderRadius: 16, padding: 17 };
