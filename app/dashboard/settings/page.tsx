import { Database, HeartPulse, KeyRound, ShieldCheck } from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard";
import { HEARTBEAT_OFFLINE_AFTER_MS, HEARTBEAT_STALE_AFTER_MS } from "@/lib/constants";

export default async function SettingsPage() {
  const { workspace, role, user } = await getDashboardContext();
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Settings</h1>
          <p className="muted">Security and runtime behavior for {workspace.name}.</p>
        </div>
      </header>
      <section className="settings-grid">
        <article className="settings-card">
          <ShieldCheck />
          <div>
            <h2>Access</h2>
            <p>Signed in as {user.email}</p>
            <dl>
              <dt>Your role</dt>
              <dd>{role}</dd>
              <dt>Workspace ID</dt>
              <dd>
                <code>{workspace.id}</code>
              </dd>
            </dl>
          </div>
        </article>
        <article className="settings-card">
          <HeartPulse />
          <div>
            <h2>Health thresholds</h2>
            <p>Health remains honest even if Realtime disconnects.</p>
            <dl>
              <dt>Stale after</dt>
              <dd>{HEARTBEAT_STALE_AFTER_MS / 1000} seconds</dd>
              <dt>Offline after</dt>
              <dd>{HEARTBEAT_OFFLINE_AFTER_MS / 1000} seconds</dd>
            </dl>
          </div>
        </article>
        <article className="settings-card">
          <KeyRound />
          <div>
            <h2>Agent credentials</h2>
            <p>
              Every agent uses a separate, hashed, revocable token. Plaintext tokens are shown once
              and never returned by the database.
            </p>
          </div>
        </article>
        <article className="settings-card">
          <Database />
          <div>
            <h2>Source of truth</h2>
            <p>
              Supabase Postgres stores state. Realtime only tells the dashboard when to refresh
              canonical rows.
            </p>
          </div>
        </article>
      </section>
      <section className="info-banner">
        <strong>Unsupported telemetry stays unavailable.</strong> Token usage, cost, pause/resume,
        and percentage progress appear only when the specific runtime supports and reports them.
      </section>
    </div>
  );
}
