import { NewAgentForm } from "@/components/new-agent-form";
import { getDashboardContext } from "@/lib/dashboard";

export default async function NewAgentPage() {
  const { workspace } = await getDashboardContext();
  return (
    <div className="page-stack narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SECURE ONBOARDING</p>
          <h1>Connect an agent</h1>
          <p className="muted">
            Create an identity and one-time credential for any compatible runtime.
          </p>
        </div>
      </header>
      <div className="info-banner">
        Tokens are never stored in plaintext. The runtime must save the token when it is shown.
      </div>
      <NewAgentForm workspaceId={workspace.id} />
    </div>
  );
}
