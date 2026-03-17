import { CheckCircle2, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Recipient } from "@/types/ui";
import { motion } from "framer-motion";

export function RecipientTracker({ recipients }: { recipients: Recipient[] }) {
  const seen = recipients.filter(r => r.seen).length;
  const total = recipients.length;
  const pct = Math.round((seen / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Sent to <span className="font-medium text-foreground">{total} members</span></span>
        <span className="text-muted-foreground">{seen} viewed, {total - seen} pending</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="space-y-2">
        {recipients.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {r.name.split(" ").map(n => n[0]).join("")}
              </div>
              <span className="text-sm font-medium">{r.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {r.seen ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                  <span className="text-status-success font-medium">Seen</span>
                  <span className="text-muted-foreground tabular-nums">{r.time}</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-status-pending" />
                  <span className="text-status-pending font-medium">Not Seen</span>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
