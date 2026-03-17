import { motion } from "framer-motion";
import { FileText, Clock, Eye, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/cms/StatCard";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { complaints, dashboardStats } from "@/data/mock";

export default function Dashboard() {
  const recentComplaints = complaints.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your complaint management system</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Complaints" value={dashboardStats.total} icon={FileText} color="primary" delay={0} trend="+2 this week" />
        <StatCard title="Pending" value={dashboardStats.pending} icon={Clock} color="high" delay={0.08} trend="Needs attention" />
        <StatCard title="Viewed Notifications" value={dashboardStats.viewed} icon={Eye} color="success" delay={0.16} />
        <StatCard title="Escalations" value={dashboardStats.escalations} icon={AlertTriangle} color="critical" delay={0.24} />
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
            {recentComplaints.map((c, i) => {
              const seen = c.recipients.filter(r => r.seen).length;
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
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{c.id}</span>
                        <StatusBadge priority={c.priority}>{c.priority}</StatusBadge>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{c.title}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 sm:flex">
                      <StatusBadge status={c.status}>{c.status}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{seen}/{c.recipients.length} seen</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* AI Insights */}
        <div className="card-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Quick AI Insights</h2>
          </div>
          <div className="space-y-3 p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-lg border border-status-ai/20 bg-status-ai/5 p-3">
              <p className="text-xs font-medium text-status-ai">Auto-Escalation Triggered</p>
              <p className="mt-1 text-xs text-muted-foreground">CMP-101 has 2 unresponsive members after 48h</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-lg border border-status-high/20 bg-status-high/5 p-3">
              <p className="text-xs font-medium text-status-high">Reminder Pending</p>
              <p className="mt-1 text-xs text-muted-foreground">CMP-105 — Raj Patel hasn't responded to 2 reminders</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="rounded-lg border border-status-success/20 bg-status-success/5 p-3">
              <p className="text-xs font-medium text-status-success">Resolution Rate</p>
              <p className="mt-1 text-xs text-muted-foreground">83% of complaints resolved within SLA this month</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Active AI Actions</p>
              <p className="mt-1 text-xs text-muted-foreground">7 reminders sent, 2 escalations, 1 reassignment this week</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
