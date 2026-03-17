import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, CheckCircle, AlertTriangle, Plus, Eye, MessageSquare, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/cms/StatCard";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ComplainantDashboard() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "other",
    priority: "medium",
  });

  const { data: complaints, isLoading, error } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: () => apiFetch<any[]>('/complaints/my'),
  });

  const createComplaintMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      apiFetch('/complaints', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      toast.success("Complaint filed successfully");
      setIsDialogOpen(false);
      setFormData({ title: "", description: "", category: "other", priority: "medium" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to file complaint");
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalFiled = complaints?.length || 0;
  const resolved = complaints?.filter(c => c.status === "resolved").length || 0;
  const inProgress = complaints?.filter(c => ["open", "assigned", "in_progress"].includes(c.status)).length || 0;
  const escalated = complaints?.filter(c => c.status === "escalated").length || 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Complaints</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your filed complaints and their progress</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> File Complaint
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>File a New Complaint</DialogTitle>
              <DialogDescription>
                Provide details about the issue you're experiencing.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Summarize the issue"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide more details..."
                  className="min-h-[100px]"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="it">IT</SelectItem>
                      <SelectItem value="facilities">Facilities</SelectItem>
                      <SelectItem value="conduct">Conduct</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createComplaintMutation.mutate(formData)}
                disabled={createComplaintMutation.isPending}
              >
                {createComplaintMutation.isPending ? "Filing..." : "File Complaint"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Filed" value={totalFiled} icon={FileText} color="primary" delay={0} />
        <StatCard title="In Progress" value={inProgress} icon={Clock} color="high" delay={0.08} trend="Being reviewed" />
        <StatCard title="Resolved" value={resolved} icon={CheckCircle} color="success" delay={0.16} />
        <StatCard title="Escalated" value={escalated} icon={AlertTriangle} color="critical" delay={0.24} />
      </div>

      <div className="grid gap-6">
        {/* My Complaints */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Your Filed Complaints</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {complaints?.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg">
                <FileText className="mx-auto h-12 w-12 opacity-20" />
                <p className="mt-4">You haven't filed any complaints yet.</p>
              </div>
            ) : (
              complaints?.map((c, i) => {
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="card-surface p-4 hover-lift"
                  >
                    <Link to={`/complaints/${c.id}`} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground tabular-nums truncate max-w-[100px]">{c.id.split('-')[0]}...</span>
                            <StatusBadge priority={c.priority}>{c.priority}</StatusBadge>
                            <StatusBadge status={c.status}>{c.status}</StatusBadge>
                          </div>
                          <h3 className="mt-1.5 text-sm font-medium text-foreground truncate">{c.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Filed on {new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        {c.aiActions?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-status-ai font-medium">
                            <Bot className="h-3.5 w-3.5" />
                            <span>{c.aiActions.length} AI Actions</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
