import { formatDistanceToNow } from "date-fns";
import { useWorkflowRuns, useComplaintWorkflowRuns } from "@/hooks/useWorkflows";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

export function RunHistory({ workflowId, complaintId }: { workflowId?: string; complaintId?: string }) {
  const wfRuns = useWorkflowRuns(workflowId || '');
  const compRuns = useComplaintWorkflowRuns(complaintId || '');

  const { data: runs = [], isLoading } = workflowId ? wfRuns : compRuns;

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (runs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">No runs yet</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {runs.map(run => (
        <div key={run.id} className="border rounded-md p-3 bg-card shadow-sm text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {run.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
               run.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> :
               <Clock className="h-4 w-4 text-amber-500" />}
              <span className="font-medium capitalize">{run.status}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {run.startedAt && formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
             <div>Complaint ID: <span className="font-mono text-foreground">{run.complaintId}</span></div>
             <div>Trigger: <span className="capitalize text-foreground">{run.triggeredBy}</span></div>
          </div>
          {run.error && (
            <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded">
              Error: {run.error}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
