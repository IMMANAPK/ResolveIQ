import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "status-badge transition-colors duration-150 inline-flex items-center gap-1.5",
  {
    variants: {
      priority: {
        low: "bg-status-low/10 text-status-low",
        medium: "bg-status-medium/10 text-status-medium",
        high: "bg-status-high/10 text-status-high",
        critical: "bg-status-critical/10 text-status-critical animate-pulse-status",
        Low: "bg-status-low/10 text-status-low",
        Medium: "bg-status-medium/10 text-status-medium",
        High: "bg-status-high/10 text-status-high",
        Critical: "bg-status-critical/10 text-status-critical animate-pulse-status",
      },
      status: {
        open: "bg-primary/10 text-primary",
        assigned: "bg-status-high/10 text-status-high",
        in_progress: "bg-status-medium/10 text-status-medium",
        resolved: "bg-status-success/10 text-status-success",
        closed: "bg-muted text-muted-foreground",
        escalated: "bg-status-critical/10 text-status-critical",
        New: "bg-primary/10 text-primary",
        "In Review": "bg-status-high/10 text-status-high",
        "In Progress": "bg-status-medium/10 text-status-medium",
        Resolved: "bg-status-success/10 text-status-success",
        Escalated: "bg-status-critical/10 text-status-critical",
      },
      type: {
        ai: "bg-status-ai/10 text-status-ai",
        seen: "bg-status-success/10 text-status-success",
        pending: "bg-status-pending/10 text-status-pending",
      },
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ children, priority, status, type, className, dot }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ priority, status, type }), className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      <span className="capitalize">{children}</span>
    </span>
  );
}
