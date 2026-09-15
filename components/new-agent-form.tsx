"use client";

import { FormEvent, useState } from "react";
import { Check, Copy } from "lucide-react";
import Link from "next/link";

export function NewAgentForm({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const capabilities = String(form.get("capabilities") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const response = await fetch("/api/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: form.get("name"),
        slug: form.get("slug"),
        description: form.get("description") || null,
        capabilities,
        runtimeType: form.get("runtimeType") || "custom",
        runtimeVersion: form.get("runtimeVersion") || null,
        maxConcurrency: Number(form.get("maxConcurrency") ?? 1),
      }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body?.error?.message ?? "Agent could not be registered.");
      return;
    }
    setToken(body.token);
  }
  if (token) {
    return (
      <section className="form-card token-reveal">
        <p className="eyebrow success-text">AGENT REGISTERED</p>
        <h2>Save this token now</h2>
        <p className="muted">
          It is stored only as a hash and cannot be shown again. Put it in the agent runtime’s
          protected secrets.
        </p>
        <code>{token}</code>
        <button
          className="button primary"
          onClick={async () => {
            await navigator.clipboard.writeText(token);
            setCopied(true);
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Copied" : "Copy token"}
        </button>
        <Link className="button secondary" href="/dashboard/agents">
          I saved the token
        </Link>
      </section>
    );
  }
  return (
    <form className="form-card form-stack" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Display name
          <input name="name" required maxLength={100} placeholder="School Assistant" />
        </label>
        <label>
          Slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="school-assistant"
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          placeholder="What this agent is responsible for"
        />
      </label>
      <label>
        Capabilities <span className="label-note">comma separated</span>
        <input name="capabilities" placeholder="homework, study sheets, presentations" />
      </label>
      <div className="form-grid">
        <label>
          Runtime type
          <select name="runtimeType" defaultValue="codex-adapter">
            <option value="codex-adapter">Codex adapter</option>
            <option value="openai-api">OpenAI API worker</option>
            <option value="custom">Custom worker</option>
            <option value="demo">Demo/test only</option>
          </select>
        </label>
        <label>
          Runtime version
          <input name="runtimeVersion" placeholder="1.0.0" />
        </label>
      </div>
      <label>
        Concurrency limit
        <input name="maxConcurrency" type="number" min="1" max="50" defaultValue="1" />
      </label>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary" disabled={loading}>
        {loading ? "Registering…" : "Register agent"}
      </button>
    </form>
  );
}
