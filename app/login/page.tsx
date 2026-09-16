"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const search = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    search.get("error") === "confirmation_failed"
      ? "The sign-in link is invalid or expired."
      : search.get("error") === "session_expired"
        ? "Your previous session expired. Sign in again to reconnect securely."
        : null,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Agent HQ is not configured yet.");
      setLoading(false);
      return;
    }
    if (mode === "magic") {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (authError) setError(authError.message);
      else setMessage("Check your email for the secure sign-in link.");
      return;
    }
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }
    const next = search.get("next");
    // A full navigation starts the authenticated dashboard with a fresh browser
    // client and Realtime socket. Keeping the pre-login client alive can leave
    // its socket on the anonymous access token until the next page reload.
    window.location.assign(next?.startsWith("/dashboard") ? next : "/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand-mark">AH</div>
        <p className="eyebrow">PRIVATE CONTROL ROOM</p>
        <h1>Know what every agent is doing—without guessing.</h1>
        <p>
          Real heartbeats, durable task history, visible failures, and safe command delivery across
          all your devices.
        </p>
        <div className="truth-card">
          <span className="live-dot" /> Live data is always reported by the agent runtime.
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <p className="eyebrow">AGENT HQ</p>
        <h2 id="login-heading">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
        <p className="muted">Your agents, tasks, logs, and files stay private to your workspace.</p>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
          {mode !== "magic" && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={10}
                required
              />
            </label>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="alert success" role="status">
              {message}
            </div>
          )}
          <button className="button primary" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "magic"
                  ? "Send sign-in link"
                  : "Sign in"}
          </button>
        </form>
        <div className="login-modes">
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signup" ? "Use existing account" : "Create account"}
          </button>
          <button onClick={() => setMode(mode === "magic" ? "signin" : "magic")}>
            {mode === "magic" ? "Use password" : "Email me a sign-in link"}
          </button>
        </div>
      </section>
    </main>
  );
}
