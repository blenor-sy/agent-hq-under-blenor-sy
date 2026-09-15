import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <main className="center-page">
        <section className="setup-card">
          <div className="brand-mark">AH</div>
          <p className="eyebrow">SETUP REQUIRED</p>
          <h1>Agent HQ is ready for its backend.</h1>
          <p className="muted">
            Add the environment variables listed in <code>.env.example</code>, apply the Supabase
            migrations, and restart the application. No demo status is being shown as live data.
          </p>
          <Link
            className="button secondary"
            href="https://github.com/blenor-sy/agent-hq-under-blenor-sy#setup"
          >
            Open setup guide
          </Link>
        </section>
      </main>
    );
  }
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/dashboard" : "/login");
}
