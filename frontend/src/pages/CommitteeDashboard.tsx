import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Eye, Bell, AlertTriangle, CheckCircle, Clock, ArrowUpRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/cms/StatCard";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { useComplaints } from "@/hooks/useComplaints";
import { useNotifications } from "@/hooks/useNotifications";
import { STATUS_LABELS, PRIORITY_LABELS, type ApiComplaintStatus } from "@/types/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function CommitteeDashboard() {
  const { user } = useAuth();
  const MEMBER_NAME = user?.fullName || "Committee Member";
  const { data: complaints = [], isLoading: loadingComplaints } = useComplaints();
  const { data: notifications = [], isLoading: loadingNotifications } = useNotifications();

  // In a real app we'd filter complaints by assignment to the committee member or use a specific endpoint
  const assignedComplaints = useMemo(() => {
    return complaints.map(c => {
      // Find notifications for this complaint
      const cNotifs = notifications.filter(n => n.complaintId === c.id);
      const recipients = cNotifs.flatMap(n => n.recipients);
      const myRecipient = recipients.find(r => r.recipientId === user?.id);

      return {
        ...c,
        mappedRecipients: recipients.map(r => ({
          name: r.recipient?.fullName || "Unknown",
          seen: r.isRead,
          time: r.readAt ? new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          id: r.id
        })),
        aiActions: cNotifs.filter(n => n.type === 'reminder' || n.type === 'escalation'),
        myStatus: myRecipient,
      };
    });
  }, [complaints, notifications, user?.id]);

  // We need to keep some local state to optimistically un-bold the row when clicked
  const [localViews, setLocalViews] = useState<Record<string, boolean>>({});

  const pendingReview = assignedComplaints.filter(c => c.myStatus && !c.myStatus.isRead && !localViews[c.id]);
  const reviewed = assignedComplaints.filter(c => (c.myStatus && c.myStatus.isRead) || localViews[c.id]);
  const escalatedCount = assignedComplaints.filter(c => c.status === "assigned" || c.status === "open").length; // proxy for escalations until we sync models perfectly
  const myNotifs = notifications.slice(0, 5);

  const markAsViewed = useCallback((complaintId: string) => {
    setLocalViews(prev => ({ ...prev, [complaintId]: true }));
    toast.success(`Marked ${complaintId.slice(0, 8)} as reviewed`);
  }, []);

  const [tab, setTab] = useState<"pending" | "reviewed" | "all">("pending");
  const displayComplaints =
    tab === "pending" ? pendingReview : tab === "reviewed" ? reviewed : assignedComplaints;

  if (loadingComplaints || loadingNotifications) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Committee Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground">{MEMBER_NAME}</span> — you have{" "}
          <span className="font-semibold text-status-high">{pendingReview.length}</span> complaints pending review
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Assigned to You" value={assignedComplaints.length} icon={FileText} color="primary" delay={0} />
        <StatCard title="Pending Review" value={pendingReview.length} icon={Clock} color="high" delay={0.08} trend="Action needed" />
        <StatCard title="Reviewed" value={reviewed.length} icon={Eye} color="success" delay={0.16} />
        <StatCard title="Escalated" value={escalatedCount} icon={AlertTriangle} color="critical" delay={0.24} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Complaints List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            {(["pending", "reviewed", "all"] as const).map(t => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
                className="text-xs capitalize"
              >
                {t === "pending" ? `Pending (${pendingReview.length})` : t === "reviewed" ? `Reviewed (${reviewed.length})` : `All (${assignedComplaints.length})`}
              </Button>
            ))}
          </div>

          {displayComplaints.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">
                {tab === "pending" ? "All caught up! No pending reviews." : "No complaints in this category."}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {displayComplaints.map((c, i) => {
                const isViewed = (c.myStatus && c.myStatus.isRead) || localViews[c.id];
                const priorityLabel = PRIORITY_LABELS[c.priority];
                const statusLabel = STATUS_LABELS[c.status];

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`card-surface p-4 hover-lift ${!isViewed ? "border-l-2 border-l-status-high" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">{c.id.slice(0, 8)}</span>
                          <StatusBadge priority={priorityLabel as ("Low" | "Medium" | "High" | "Critical")}>{priorityLabel}</StatusBadge>
                          <StatusBadge status={statusLabel as ("New" | "In Review" | "In Progress" | "Escalated" | "Resolved")}>{statusLabel}</StatusBadge>
                          {!isViewed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-status-high/10 px-2 py-0.5 text-[10px] font-medium text-status-high">
                              <Bell className="h-2.5 w-2.5" /> Needs Review
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-sm font-medium text-foreground">{c.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        {!isViewed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsViewed(c.id)}
                            className="text-xs border-status-success/30 text-status-success hover:bg-status-success/10"
                          >
                            <Eye className="mr-1 h-3 w-3" /> Mark Reviewed
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" asChild className="text-xs text-primary">
                          <Link to={`/complaints/${c.id}`}>
                            Details <ArrowUpRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {/* Recipient overview */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {c.mappedRecipients.filter(r => r.seen).length}/{c.mappedRecipients.length} viewed
                      </span>
                      <span>
                        Filed {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {c.aiActions.length > 0 && (
                        <span className="text-status-ai">
                          {c.aiActions.length} AI action{c.aiActions.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {isViewed && c.myStatus?.readAt && (
                      <p className="mt-1 text-[11px] text-status-success">
                        ✓ You reviewed at {new Date(c.myStatus.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Action Required */}
          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {pendingReview.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div>
                    <p className="text-xs font-medium text-foreground">{c.id}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{c.title}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => markAsViewed(c.id)} className="text-[11px] h-7">
                    Review
                  </Button>
                </div>
              ))}
              {pendingReview.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No pending actions</p>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="card-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
              <Link to="/notifications" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {myNotifs.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-md p-2.5 text-xs transition-colors ${!n.allRead ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}
                >
                  <p className="font-medium text-foreground">{n.type === 'initial' ? 'New Complaint Alert' : 'System Notification'}</p>
                  <p className="mt-0.5 text-muted-foreground">Complaint #{n.complaintId.slice(0, 8)} needs review</p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Performance */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-surface p-4"
          >
            <h2 className="text-sm font-semibold text-foreground mb-3">Your Performance</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Response Rate</span>
                  <span className="font-medium text-foreground">
                    {assignedComplaints.length > 0 ? Math.round((reviewed.length / assignedComplaints.length) * 100) : 100}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-status-success"
                    initial={{ width: 0 }}
                    animate={{ width: `${assignedComplaints.length > 0 ? (reviewed.length / assignedComplaints.length) * 100 : 100}%` }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg. Response Time</span>
                <span className="font-medium text-foreground">2.4 hrs</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reminders Received</span>
                <span className="font-medium text-status-high">0</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
