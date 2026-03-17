import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, CheckCircle, AlertTriangle, Plus, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/cms/StatCard";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { FileComplaintDialog } from "@/components/cms/FileComplaintDialog";
import { useComplaints } from "@/hooks/useComplaints";
import { useNotifications } from "@/hooks/useNotifications";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types/api";

export default function ComplainantDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: myComplaints = [] } = useComplaints();
  const { data: allNotifications = [] } = useNotifications();

  const myNotifications = allNotifications.slice(0, 5);

  const totalFiled = myComplaints.length;
  const resolved = myComplaints.filter(c => c.status === "resolved" || c.status === "closed").length;
  const inProgress = myComplaints.filter(c => c.status === "in_progress" || c.status === "assigned").length;
  const escalated = 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Complaints</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your filed complaints and their progress</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> File Complaint
        </Button>
        <FileComplaintDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Filed" value={totalFiled} icon={FileText} color="primary" delay={0} />
        <StatCard title="In Progress" value={inProgress} icon={Clock} color="high" delay={0.08} trend="Being reviewed" />
        <StatCard title="Resolved" value={resolved} icon={CheckCircle} color="success" delay={0.16} />
        <StatCard title="Escalated" value={escalated} icon={AlertTriangle} color="critical" delay={0.24} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My Complaints */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Your Filed Complaints</h2>
          <div className="space-y-3">
            {myComplaints.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No complaints filed yet</p>
            ) : (
              myComplaints.map((c, i) => (
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
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">{c.id.slice(0, 8)}</span>
                          <StatusBadge priority={PRIORITY_LABELS[c.priority]}>{PRIORITY_LABELS[c.priority]}</StatusBadge>
                          <StatusBadge status={STATUS_LABELS[c.status]}>{STATUS_LABELS[c.status]}</StatusBadge>
                        </div>
                        <h3 className="mt-1.5 text-sm font-medium text-foreground">{c.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar — Updates */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Recent Updates</h2>
          <div className="space-y-2">
            {myNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No updates yet</p>
            ) : (
              myNotifications.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`card-surface p-3 text-sm transition-colors hover:bg-muted/30 ${!n.allRead ? "border-l-2 border-l-primary" : ""}`}
                >
                  <p className="text-xs font-medium text-foreground capitalize">{n.type.replace("_", " ")} notification</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Complaint: {n.complaintId?.slice(0, 8)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </motion.div>
              ))
            )}
          </div>

          {/* Status Legend */}
          <div className="card-surface p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">Status Guide</h3>
            <div className="space-y-2">
              {(["New", "In Review", "In Progress", "Resolved", "Escalated"] as const).map(s => (
                <div key={s} className="flex items-center gap-2">
                  <StatusBadge status={s}>{s}</StatusBadge>
                  <span className="text-[11px] text-muted-foreground">
                    {s === "New" && "Your complaint has been filed"}
                    {s === "In Review" && "Committee is reviewing"}
                    {s === "In Progress" && "Action is being taken"}
                    {s === "Resolved" && "Issue has been resolved"}
                    {s === "Escalated" && "Escalated to higher authority"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
