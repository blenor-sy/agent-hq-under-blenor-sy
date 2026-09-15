import Link from "next/link";
import {
  Activity,
  Bell,
  Bot,
  Boxes,
  CalendarClock,
  Files,
  Gauge,
  ListTodo,
  Settings,
} from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard";
import { LiveRefresh } from "@/components/live-refresh";
import { SignOutButton } from "@/components/sign-out";

export const dynamic = "force-dynamic";

const navigation = [
  ["Overview", "/dashboard", Gauge],
  ["Agents", "/dashboard/agents", Bot],
  ["Tasks", "/dashboard/tasks", ListTodo],
  ["Activity", "/dashboard/activity", Activity],
  ["Artifacts", "/dashboard/artifacts", Files],
  ["Schedules", "/dashboard/schedules", CalendarClock],
  ["Alerts", "/dashboard/notifications", Bell],
  ["Settings", "/dashboard/settings", Settings],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { workspace, user } = await getDashboardContext();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark small">AH</span>
          <span>
            <strong>Agent HQ</strong>
            <small>{workspace.name}</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map(([label, href, Icon]) => (
            <Link href={href} key={href}>
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <LiveRefresh workspaceId={workspace.id} />
          <div className="account-row">
            <span className="avatar">{user.email?.slice(0, 1).toUpperCase() ?? "U"}</span>
            <span className="account-copy">
              <strong>{user.email}</strong>
              <small>Signed in</small>
            </span>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <div className="mobile-topbar">
        <Link className="brand" href="/dashboard">
          <Boxes size={20} /> Agent HQ
        </Link>
        <LiveRefresh workspaceId={workspace.id} />
      </div>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
