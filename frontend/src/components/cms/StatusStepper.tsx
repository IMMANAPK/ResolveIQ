import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

const steps = ["open", "assigned", "in_progress", "resolved"];
const stepLabels: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export function StatusStepper({ current }: { current: string }) {
  const isEscalated = current === "escalated" || current === "Escalated";
  const normalizedCurrent = current.toLowerCase();
  const currentIdx = isEscalated ? 1 : steps.indexOf(normalizedCurrent);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const done = i <= currentIdx && currentIdx !== -1;
        const active = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              active && !isEscalated && "bg-primary text-primary-foreground",
            )}>
              {done && i < currentIdx && <CheckCircle2 className="h-3 w-3" />}
              {stepLabels[step] || step}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px w-4", done ? "bg-primary/40" : "bg-border")} />
            )}
          </div>
        );
      })}
      {isEscalated && (
        <>
          <div className="h-px w-4 bg-status-critical/40" />
          <div className="rounded-full bg-status-critical px-3 py-1 text-xs font-medium text-destructive-foreground animate-pulse-status">
            Escalated
          </div>
        </>
      )}
    </div>
  );
}
