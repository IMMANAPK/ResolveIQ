import { motion } from "framer-motion";
import { FileText, Mail, Eye, Bell, AlertTriangle, UserCheck, CheckCircle2 } from "lucide-react";
import type { TimelineEvent } from "@/data/mock";
import { cn } from "@/lib/utils";

const iconMap: Record<TimelineEvent["type"], React.ElementType> = {
  created: FileText,
  email_sent: Mail,
  viewed: Eye,
  reminder: Bell,
  escalation: AlertTriangle,
  reassignment: UserCheck,
  resolved: CheckCircle2,
};

const colorMap: Record<TimelineEvent["type"], string> = {
  created: "bg-primary/10 text-primary",
  email_sent: "bg-status-medium/10 text-status-medium",
  viewed: "bg-status-success/10 text-status-success",
  reminder: "bg-status-ai/10 text-status-ai",
  escalation: "bg-status-critical/10 text-status-critical",
  reassignment: "bg-status-high/10 text-status-high",
  resolved: "bg-status-success/10 text-status-success",
};

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative space-y-0">
      {events.map((event, i) => {
        const Icon = iconMap[event.type];
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="relative flex gap-3 pb-6 last:pb-0"
          >
            {/* Vertical line */}
            {i < events.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            {/* Icon */}
            <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorMap[event.type])}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            {/* Content */}
            <div className="flex-1 pt-0.5">
              <p className="text-sm text-foreground">{event.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {new Date(event.timestamp).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
