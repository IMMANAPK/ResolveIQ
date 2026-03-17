import { motion } from "framer-motion";
import { Mail, Eye, Bell, UserCheck, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { adminLogs } from "@/data/mock";
import { cn } from "@/lib/utils";

const typeIcon: Record<string, React.ElementType> = {
  email: Mail,
  view: Eye,
  reminder: Bell,
  reassignment: UserCheck,
  escalation: AlertTriangle,
};

const typeBg: Record<string, string> = {
  email: "bg-status-medium/10",
  view: "bg-status-success/10",
  reminder: "bg-status-ai/10",
  reassignment: "bg-status-high/10",
  escalation: "bg-status-critical/10",
};

const typeText: Record<string, string> = {
  email: "text-status-medium",
  view: "text-status-success",
  reminder: "text-status-ai",
  reassignment: "text-status-high",
  escalation: "text-status-critical",
};

export default function AdminPanel() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">System activity logs and audit trail</p>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="hidden border-b border-border bg-muted/30 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</div>
          <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</div>
          <div className="col-span-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Target</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">User</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Timestamp</div>
        </div>

        <div className="divide-y divide-border">
          {adminLogs.map((log, i) => {
            const Icon = typeIcon[log.type] || Mail;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-1 gap-2 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/30 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-1">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", typeBg[log.type])}>
                    <Icon className={cn("h-3.5 w-3.5", typeText[log.type])} />
                  </div>
                </div>
                <div className="col-span-3 text-sm font-medium text-foreground">{log.action}</div>
                <div className="col-span-4 text-sm text-muted-foreground">{log.target}</div>
                <div className="col-span-2">
                  <StatusBadge type={log.user.includes("AI") ? "ai" : undefined} className={!log.user.includes("AI") ? "bg-muted text-foreground" : undefined}>
                    {log.user}
                  </StatusBadge>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground tabular-nums">{log.timestamp}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
