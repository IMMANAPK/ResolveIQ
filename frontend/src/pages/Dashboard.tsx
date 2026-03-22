import { useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, Eye, AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/cms/StatCard";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { socket } from "@/lib/socket";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: complaints, isLoading } = useQuery({
    queryKey: ['admin-complaints'],
    queryFn: () => apiFetch<any[]>('/complaints'),
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
    };

    socket.on('notification:read', handleUpdate);
    socket.on('escalation:triggered', handleUpdate);

    return () => {
      socket.off('notification:read', handleUpdate);
      socket.off('escalation:triggered', handleUpdate);
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allComplaints = complaints || [];
  const recentComplaints = allComplaints.slice(0, 5);
  const pending = allComplaints.filter(c => ["open", "assigned", "in_progress"].includes(c.status)).length;
  const escalated = allComplaints.filter(c => c.status === "escalated").length;
  const resolved = allComplaints.filter(c => c.status === "resolved").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your complaint management system</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Complaints" value={allComplaints.length} icon={FileText} color="primary" delay={0} />
        <StatCard title="Pending Review" value={pending} icon={Clock} color="high" delay={0.08} trend="Needs attention" />
        <StatCard title="Resolved" value={resolved} icon={Eye} color="success" delay={0.16} />
        <StatCard title="Escalations" value={escalated} icon={AlertTriangle} color="critical" delay={0.24} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Complaints */}
        <div className="lg:col-span-2 card-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Complaints</h2>
            <Link to="/complaints" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentComplaints.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No complaints yet.</div>
            ) : (
              recentComplaints.map((c, i) => {
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={`/complaints/${c.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground tabular-nums truncate max-w-[80px]">{c.id.split('-')[0]}...</span>
                          <StatusBadge priority={c.priority}>{c.priority}</StatusBadge>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-foreground">{c.title}</p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-3 sm:flex">
                        <StatusBadge status={c.status}>{c.status}</StatusBadge>
                        <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* AI Insights */}
        <div className="card-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">AI Insights</h2>
          </div>
          <div className="space-y-3 p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-lg border border-status-ai/20 bg-status-ai/5 p-3">
              <p className="text-xs font-medium text-status-ai">Resolution Rate</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {allComplaints.length > 0 ? Math.round((resolved / allComplaints.length) * 100) : 0}% of complaints resolved.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-lg border border-status-high/20 bg-status-high/5 p-3">
              <p className="text-xs font-medium text-status-high">Escalation Alert</p>
              <p className="mt-1 text-xs text-muted-foreground">{escalated} complaints currently escalated.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
