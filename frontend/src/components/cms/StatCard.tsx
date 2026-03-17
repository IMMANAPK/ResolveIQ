import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  color: "primary" | "critical" | "high" | "success";
  delay?: number;
}

const colorStyles = {
  primary: "bg-primary/10 text-primary",
  critical: "bg-status-critical/10 text-status-critical",
  high: "bg-status-high/10 text-status-high",
  success: "bg-status-success/10 text-status-success",
};

export function StatCard({ title, value, icon: Icon, trend, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="card-surface p-5 hover-lift"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colorStyles[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
