import { useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, Plus, FileEdit, Trash2, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkflows, useDeleteWorkflow, useUpdateWorkflow } from "@/hooks/useWorkflows";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export default function WorkflowList() {
  const { data: workflows = [], isLoading } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  const updateWorkflow = useUpdateWorkflow();

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateWorkflow.mutateAsync({ id, isActive });
      toast.success(isActive ? "Workflow activated" : "Workflow deactivated");
    } catch {
      toast.error("Failed to toggle workflow");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      await deleteWorkflow.mutateAsync(id);
      toast.success("Workflow deleted");
    } catch {
      toast.error("Failed to delete workflow");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automate actions based on events using visual workflows.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/workflows/new">
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <GitBranch className="h-8 w-8" />
            <p>No workflows found</p>
          </div>
        ) : (
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr className="[&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground">
                  <th>Name</th>
                  <th>Trigger</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr]:border-b [&_tr:last-child]:border-0">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{wf.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {wf.trigger.type === 'event' ? wf.trigger.event : 'Manual'}
                    </td>
                    <td className="px-4 py-3">v{wf.definitionVersion}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={wf.isActive} 
                          onCheckedChange={(v) => handleToggle(wf.id, v)} 
                        />
                        <span className="text-xs text-muted-foreground">
                          {wf.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                        <Link to={`/admin/workflows/${wf.id}`}>
                          <FileEdit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(wf.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
