import { motion } from "framer-motion";
import { Mail, Bell, UserCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { ApiNotification } from "@/types/api";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  initial: { icon: Mail, bg: "bg-status-medium/10", text: "text-status-medium", label: "Email Sent" },
  reminder: { icon: Bell, bg: "bg-status-ai/10", text: "text-status-ai", label: "AI Reminder" },
  re_routed: { icon: UserCheck, bg: "bg-status-high/10", text: "text-status-high", label: "Re-routed" },
  escalation: { icon: AlertTriangle, bg: "bg-status-critical/10", text: "text-status-critical", label: "Escalation" },
};

function getTarget(n: ApiNotification): string {
  const title = n.complaint?.title ?? n.complaintId.slice(0, 8);
  return `${title} — ${n.recipients.length} recipient(s)`;
}

export default function AdminPanel() {
  const { data: notifications = [], isLoading } = useNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">System notification activity and audit trail</p>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="hidden border-b border-border bg-muted/30 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</div>
          <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</div>
          <div className="col-span-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Target</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Timestamp</div>
        </div>

        <div className="divide-y divide-border">
          {notifications.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No activity yet.</div>
          )}
          {notifications.map((n, i) => {
            const cfg = typeConfig[n.type] ?? typeConfig.initial;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-1 gap-2 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/30 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-1">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", cfg.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", cfg.text)} />
                  </div>
                </div>
                <div className="col-span-3 text-sm font-medium text-foreground">{cfg.label}</div>
                <div className="col-span-4 text-sm text-muted-foreground truncate">{getTarget(n)}</div>
                <div className="col-span-2 text-xs text-muted-foreground capitalize">{n.channel}</div>
                <div className="col-span-2 text-xs text-muted-foreground tabular-nums">
                  {new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
