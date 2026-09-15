import Link from "next/link";
import { Bell } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getDashboardContext } from "@/lib/dashboard";
import { relativeTime } from "@/lib/time";

export default async function NotificationsPage() {
  const { supabase, workspace } = await getDashboardContext();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">ATTENTION</p>
          <h1>Notifications</h1>
          <p className="muted">Persisted failures and offline signals.</p>
        </div>
      </header>
      {data?.length ? (
        <div className="table-card simple-list">
          {data.map((notification) => (
            <div key={notification.id}>
              <span>
                <strong>{notification.title}</strong>
                <small>
                  {notification.message || "No additional details"} ·{" "}
                  {relativeTime(notification.created_at)}
                </small>
              </span>
              <span>
                <StatusPill value={notification.read_at ? "read" : "unread"} />
                {notification.entity_id && (
                  <Link
                    className="button ghost small-button"
                    href={
                      notification.entity_type === "task"
                        ? `/dashboard/tasks/${notification.entity_id}`
                        : `/dashboard/agents/${notification.entity_id}`
                    }
                  >
                    Open
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Bell />
          </span>
          <h2>No notifications</h2>
          <p>Agent failures and offline events will appear here.</p>
        </div>
      )}
    </div>
  );
}
