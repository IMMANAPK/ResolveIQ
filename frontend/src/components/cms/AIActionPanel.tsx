import { Bot, Bell, AlertTriangle, UserCheck, Sparkles } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import type { AIAction } from "@/data/mock";
import { motion } from "framer-motion";

const iconMap: Record<AIAction["type"], React.ElementType> = {
  reminder: Bell,
  escalation: AlertTriangle,
  reassignment: UserCheck,
};

interface AIActionPanelProps {
  actions: AIAction[];
  onTriggerReminder?: () => void;
  onTriggerEscalation?: () => void;
  onReassign?: () => void;
}

export function AIActionPanel({ actions, onTriggerReminder, onTriggerEscalation, onReassign }: AIActionPanelProps) {
  return (
    <div className="space-y-4 rounded-lg border border-status-ai/20 bg-status-ai/5 p-4 ai-glow">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-status-ai/15">
          <Bot className="h-4 w-4 text-status-ai" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">AI Actions</h3>
        <Sparkles className="h-3.5 w-3.5 text-status-ai" />
      </div>

      {actions.length > 0 ? (
        <div className="space-y-2">
          {actions.map((action, i) => {
            const Icon = iconMap[action.type];
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-2.5 rounded-md bg-card p-3 border border-border"
              >
                <div className="mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-status-ai" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{action.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {new Date(action.timestamp).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                    })}
                  </p>
                </div>
                <StatusBadge type="ai">{action.type}</StatusBadge>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No AI actions taken yet.</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" className="text-xs border-status-ai/30 text-status-ai hover:bg-status-ai/10" onClick={onTriggerReminder}>
          <Bell className="mr-1.5 h-3 w-3" /> Trigger Reminder
        </Button>
        <Button size="sm" variant="outline" className="text-xs border-status-critical/30 text-status-critical hover:bg-status-critical/10" onClick={onTriggerEscalation}>
          <AlertTriangle className="mr-1.5 h-3 w-3" /> Trigger Escalation
        </Button>
        <Button size="sm" variant="outline" className="text-xs border-status-high/30 text-status-high hover:bg-status-high/10" onClick={onReassign}>
          <UserCheck className="mr-1.5 h-3 w-3" /> Reassign Member
        </Button>
      </div>
    </div>
  );
}
