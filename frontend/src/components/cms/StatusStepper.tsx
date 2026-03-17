import { cn } from "@/lib/utils";
import type { Status } from "@/types/ui";
import { CheckCircle2 } from "lucide-react";

const steps: Status[] = ["New", "In Review", "In Progress", "Resolved"];

export function StatusStepper({ current }: { current: Status }) {
  const isEscalated = current === "Escalated";
  const currentIdx = isEscalated ? 2 : steps.indexOf(current);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              active && !isEscalated && "bg-primary text-primary-foreground",
              active && isEscalated && "bg-status-critical text-destructive-foreground",
            )}>
              {done && i < currentIdx && <CheckCircle2 className="h-3 w-3" />}
              {step}
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
