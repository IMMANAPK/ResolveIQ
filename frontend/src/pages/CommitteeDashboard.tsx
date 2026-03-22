import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Eye, Bell, AlertTriangle, CheckCircle, Clock, ArrowUpRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/cms/StatCard";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { socket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function CommitteeDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "resolved" | "all">("pending");

  const { data: complaints, isLoading, error } = useQuery({
    queryKey: ['committee-complaints'],
    queryFn: () => apiFetch<any[]>('/complaints'),
    enabled: !!user,
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['committee-complaints'] });
    };

    socket.on('notification:read', handleUpdate);
    socket.on('escalation:triggered', handleUpdate);

    return () => {
      socket.off('notification:read', handleUpdate);
      socket.off('escalation:triggered', handleUpdate);
    };
  }, [queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => 
      apiFetch(`/complaints/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee-complaints'] });
      toast.success("Status updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allComplaints = complaints || [];
  const pending = allComplaints.filter(c => ["open", "assigned", "in_progress"].includes(c.status));
  const resolved = allComplaints.filter(c => c.status === "resolved");
  const escalated = allComplaints.filter(c => c.status === "escalated");

  const displayComplaints =
    tab === "pending" ? pending : tab === "resolved" ? resolved : allComplaints;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Committee Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground">{user?.fullName}</span> — there are{" "}
          <span className="font-semibold text-status-high">{pending.length}</span> complaints pending action
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Complaints" value={allComplaints.length} icon={FileText} color="primary" delay={0} />
        <StatCard title="Pending Action" value={pending.length} icon={Clock} color="high" delay={0.08} trend="Action needed" />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} color="success" delay={0.16} />
        <StatCard title="Escalated" value={escalated.length} icon={AlertTriangle} color="critical" delay={0.24} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Complaints List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            {(["pending", "resolved", "all"] as const).map(t => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
                className="text-xs capitalize"
              >
                {t === "pending" ? `Pending (${pending.length})` : t === "resolved" ? `Resolved (${resolved.length})` : `All (${allComplaints.length})`}
              </Button>
            ))}
          </div>

          {displayComplaints.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
              <CheckCircle className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">
                No complaints in this category.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {displayComplaints.map((c, i) => {
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="card-surface p-4 hover-lift"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground tabular-nums truncate max-w-[100px]">{c.id.split('-')[0]}...</span>
                          <StatusBadge priority={c.priority}>{c.priority}</StatusBadge>
                          <StatusBadge status={c.status}>{c.status}</StatusBadge>
                        </div>
                        <h3 className="mt-1.5 text-sm font-medium text-foreground truncate">{c.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="ghost" asChild className="text-xs text-primary">
                          <Link to={`/complaints/${c.id}`}>
                            Details <ArrowUpRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Filed by {c.raisedBy?.fullName || 'Anonymous'} on {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        {c.status !== 'resolved' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px]"
                            onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'resolved' })}
                            disabled={updateStatusMutation.isPending}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">System Updates</h2>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Real-time updates will appear here.</p>
            </div>
          </div>

          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Committee Actions</h2>
            <div className="grid gap-2">
              <Button variant="outline" size="sm" className="w-full text-xs justify-start" asChild>
                <Link to="/complaints">View All Complaints</Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs justify-start" asChild>
                <Link to="/notifications">View Notifications</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
