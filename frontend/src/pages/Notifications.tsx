import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import type { ApiNotification } from "@/types/api";
import { PRIORITY_LABELS } from "@/types/api";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";

function getNotifTitle(n: ApiNotification): string {
  switch (n.type) {
    case "initial": return "New Complaint Notification";
    case "reminder": return "AI Reminder Sent";
    case "escalation": return "Escalation Alert";
    case "re_routed": return "Notification Re-routed";
    default: return "Notification";
  }
}

function getNotifMessage(n: ApiNotification): string {
  const title = n.complaint?.title ?? n.complaintId.slice(0, 8);
  const count = n.recipients.length;
  switch (n.type) {
    case "initial": return `Email sent to ${count} recipient(s) for: ${title}`;
    case "reminder": return `AI reminder sent to ${count} recipient(s) for: ${title}`;
    case "escalation": return `Escalation triggered for: ${title}`;
    case "re_routed": return `Notification rerouted to ${count} available member(s) for: ${title}`;
    default: return title;
  }
}

function getNotifPriority(n: ApiNotification): string {
  const p = n.complaint?.priority;
  if (!p) return "Medium";
  return PRIORITY_LABELS[p] ?? "Medium";
}

export default function Notifications() {
  const { user } = useAuth();
  const isPrivileged = user?.roles?.some((r) => ['admin', 'manager', 'committee_member'].includes(r));
  const { data: notifications = [], isLoading } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const isRead = (n: ApiNotification) => n.allRead || readIds.has(n.id);

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !isRead(n);
    if (filter === "read") return isRead(n);
    return true;
  });

  const unreadCount = notifications.filter(n => !isRead(n)).length;

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const markAllRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isPrivileged ? "All Notifications" : "My Notifications"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPrivileged
              ? `${unreadCount} unread across all complaints`
              : `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""} for your complaints`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
          Mark all read
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "unread", "read"] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          filtered.map((n, i) => {
            const read = isRead(n);
            const priority = getNotifPriority(n);
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => markRead(n.id)}
                className={`card-surface flex cursor-pointer items-start gap-3 p-4 transition-colors duration-150 hover:bg-muted/30 ${!read ? "border-l-2 border-l-primary" : ""}`}
              >
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${read ? "bg-transparent" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{getNotifTitle(n)}</p>
                    <StatusBadge priority={priority as never}>{priority}</StatusBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{getNotifMessage(n)}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
