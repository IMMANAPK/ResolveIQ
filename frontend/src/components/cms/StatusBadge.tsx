import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "status-badge transition-colors duration-150",
  {
    variants: {
      priority: {
        Low: "bg-status-low/10 text-status-low",
        Medium: "bg-status-medium/10 text-status-medium",
        High: "bg-status-high/10 text-status-high",
        Critical: "bg-status-critical/10 text-status-critical animate-pulse-status",
      },
      status: {
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
      {children}
    </span>
  );
}
