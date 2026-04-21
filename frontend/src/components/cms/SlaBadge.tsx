import { Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface SlaBadgeProps {
  slaDeadline?: string;
  slaBreached?: boolean;
  slaBreachedAt?: string;
  createdAt?: string;
  status?: string;
}

function formatTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / 3600000);
  const minutes = Math.floor((absDiff % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SlaBadge({ slaDeadline, slaBreached, slaBreachedAt, createdAt, status }: SlaBadgeProps) {
  if (!slaDeadline) return null;

  const deadline = new Date(slaDeadline);
  const now = new Date();
  const isResolved = status === "resolved" || status === "closed";

  if (isResolved) {
    if (slaBreached) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          Breached
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Met SLA
      </span>
    );
  }

  if (slaBreached) {
    const since = slaBreachedAt ? formatTimeRemaining(new Date(slaBreachedAt)) : "";
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" />
        SLA Breached {since && `(${since} ago)`}
      </span>
    );
  }

  const remaining = deadline.getTime() - now.getTime();
  const totalWindow = createdAt
    ? deadline.getTime() - new Date(createdAt).getTime()
    : remaining;
  const isAtRisk = remaining > 0 && totalWindow > 0 && remaining / totalWindow < 0.2;

  if (isAtRisk) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" />
        At Risk - {formatTimeRemaining(deadline)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <Clock className="h-3 w-3" />
      On Track - {formatTimeRemaining(deadline)}
    </span>
  );
}
