"use client";

import { useEffect, useState } from "react";

interface TokenRow {
  id: string;
  label: string;
  token_prefix: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function TokenManager({ agentId }: { agentId: string }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  async function load() {
    const response = await fetch(`/api/v1/agents/${agentId}/tokens`);
    const body = await response.json();
    setLoading(false);
    if (!response.ok) setError(body?.error?.message ?? "Credentials unavailable.");
    else setTokens(body.tokens);
  }
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/v1/agents/${agentId}/tokens`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (cancelled) return;
        setLoading(false);
        if (!response.ok) setError(body?.error?.message ?? "Credentials unavailable.");
        else setTokens(body.tokens);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);
  async function rotate() {
    setError(null);
    const response = await fetch(`/api/v1/agents/${agentId}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: `rotated-${new Date().toISOString().slice(0, 10)}` }),
    });
    const body = await response.json();
    if (!response.ok) setError(body?.error?.message ?? "Could not create token.");
    else {
      setRevealed(body.token);
      await load();
    }
  }
  async function revoke(tokenId: string) {
    if (!window.confirm("Revoke this credential? Its runtime will immediately lose access."))
      return;
    const response = await fetch(`/api/v1/agents/${agentId}/tokens`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body?.error?.message ?? "Could not revoke token.");
    } else await load();
  }
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Credentials</h2>
          <p>Hashed, revocable, and private from browser database access.</p>
        </div>
        <button className="button secondary" onClick={rotate}>
          Create replacement
        </button>
      </div>
      {revealed && (
        <div className="alert success">
          <strong>Copy this token now—it will not appear again.</strong>
          <code className="block-code">{revealed}</code>
          <button
            className="button secondary small-button"
            onClick={() => navigator.clipboard.writeText(revealed)}
          >
            Copy
          </button>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      <div className="table-card simple-list">
        {loading ? (
          <div className="empty-inline">Loading credentials…</div>
        ) : (
          tokens.map((token) => (
            <div key={token.id}>
              <span>
                <strong>
                  {token.label} · {token.token_prefix ?? "hidden"}…
                </strong>
                <small>
                  {token.revoked_at
                    ? "Revoked"
                    : token.last_used_at
                      ? `Last used ${new Date(token.last_used_at).toLocaleString()}`
                      : "Never used"}
                </small>
              </span>
              {token.revoked_at ? (
                <span className="muted">Inactive</span>
              ) : (
                <button className="button danger small-button" onClick={() => revoke(token.id)}>
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
