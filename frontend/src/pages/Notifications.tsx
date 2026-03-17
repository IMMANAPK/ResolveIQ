import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { notifications as initialNotifications } from "@/data/mock";
import type { Notification } from "@/data/mock";

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const filtered = items.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.filter(n => !n.read).length} unread</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
          <Check className="mr-1.5 h-3 w-3" /> Mark all read
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
          filtered.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => markRead(n.id)}
              className={`card-surface flex cursor-pointer items-start gap-3 p-4 transition-colors duration-150 hover:bg-muted/30 ${!n.read ? "border-l-2 border-l-primary" : ""}`}
            >
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <StatusBadge priority={n.priority}>{n.priority}</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{n.time}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
