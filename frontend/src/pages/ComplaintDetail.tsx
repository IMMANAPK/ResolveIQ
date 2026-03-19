import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { ArrowLeft, Loader2, Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { StatusStepper } from "@/components/cms/StatusStepper";
import { RecipientTracker } from "@/components/cms/RecipientTracker";
import { AIActionPanel } from "@/components/cms/AIActionPanel";
import { ActivityTimeline } from "@/components/cms/ActivityTimeline";
import { RunHistory } from "@/components/workflows/RunHistory";
import type { AIAction, TimelineEvent, Recipient } from "@/types/ui";
import { useComplaint, useRegenerateSummary } from "@/hooks/useComplaints";
import { useNotificationsForComplaint } from "@/hooks/useNotifications";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEscalationHistory, useTriggerEscalation } from "@/hooks/useEscalation";
import { PRIORITY_LABELS, STATUS_LABELS, CATEGORY_LABELS } from "@/types/api";
import type { ApiNotification, ApiEscalationLog } from "@/types/api";
import { toast } from "sonner";

function buildRecipients(notifications: ApiNotification[]): Recipient[] {
  const seen = new Map<string, Recipient>();
  for (const notif of notifications) {
    for (const r of notif.recipients) {
      const name = r.user?.fullName ?? r.userId;
      const time = r.readAt
        ? new Date(r.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : undefined;
      if (!seen.has(r.userId)) {
        seen.set(r.userId, { name, seen: r.isRead, time });
      } else if (r.isRead && !seen.get(r.userId)!.seen) {
        seen.set(r.userId, { name, seen: true, time });
      }
    }
  }
  return Array.from(seen.values());
}

function buildTimeline(notifications: ApiNotification[], escalations: ApiEscalationLog[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const notif of notifications) {
    if (notif.type === "initial") {
      events.push({ id: "email-" + notif.id, type: "email_sent", description: "Email sent to " + notif.recipients.length + " recipient(s)", timestamp: notif.createdAt });
    } else if (notif.type === "reminder") {
      events.push({ id: "reminder-" + notif.id, type: "reminder", description: "AI reminder sent", timestamp: notif.createdAt });
    } else if (notif.type === "re_routed") {
      events.push({ id: "reroute-" + notif.id, type: "reassignment", description: "Notification rerouted to available members", timestamp: notif.createdAt });
    }
    for (const r of notif.recipients) {
      if (r.isRead && r.readAt) {
        events.push({ id: "viewed-" + r.id, type: "viewed", description: "Viewed by " + (r.user?.fullName ?? r.userId), timestamp: r.readAt, user: r.user?.fullName });
      }
    }
  }
  for (const esc of escalations) {
    events.push({ id: "esc-" + esc.id, type: "escalation", description: "Escalation - step: " + esc.step, timestamp: esc.createdAt });
  }
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function buildAiActions(notifications: ApiNotification[], escalations: ApiEscalationLog[]): AIAction[] {
  const actions: AIAction[] = [];
  for (const notif of notifications) {
    if (notif.type === "reminder") {
      actions.push({ id: "ai-" + notif.id, type: "reminder", message: "AI Reminder sent to " + notif.recipients.length + " recipient(s)", timestamp: notif.createdAt });
    } else if (notif.type === "re_routed") {
      actions.push({ id: "ai-reroute-" + notif.id, type: "reassignment", message: "Notification rerouted to available members", timestamp: notif.createdAt });
    }
  }
  for (const esc of escalations) {
    actions.push({ id: "ai-esc-" + esc.id, type: "escalation", message: "Escalation: " + esc.step + " (" + esc.status + ")", timestamp: esc.createdAt });
  }
  return actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: complaint, isLoading: loadingComplaint, isError: complaintError } = useComplaint(id!);
  const { data: notifications = [], isLoading: loadingNotifs } = useNotificationsForComplaint(id!);
  const { data: escalations = [], isLoading: loadingEsc } = useEscalationHistory(id!);
  const triggerEscalation = useTriggerEscalation();
  const regenerate = useRegenerateSummary();
  const isLoading = loadingComplaint || loadingNotifs || loadingEsc;

  useEffect(() => {
    if (!complaint?.id) return;
    const socket = getSocket();
    socket.emit('join:complaint', complaint.id);
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['complaints', complaint.id] });
    };
    socket.on('complaint.summary.updated', handler);
    return () => { socket.off('complaint.summary.updated', handler); };
  }, [complaint?.id, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (complaintError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-lg font-semibold text-foreground">Unable to load complaint</p>
        <p className="text-sm text-muted-foreground">The server may be unavailable. Please try again shortly.</p>
        <Button variant="outline" asChild className="mt-2">
          <Link to="/complaints">Back to Complaints</Link>
        </Button>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-foreground">Complaint not found</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/complaints">Back to Complaints</Link>
        </Button>
      </div>
    );
  }

  const recipients = buildRecipients(notifications);
  const timeline = buildTimeline(notifications, escalations);
  const aiActions = buildAiActions(notifications, escalations);
  const priorityLabel = PRIORITY_LABELS[complaint.priority] ?? complaint.priority;
  const statusLabel = STATUS_LABELS[complaint.status] ?? complaint.status;
  const categoryLabel = CATEGORY_LABELS[complaint.category] ?? complaint.category;

  const handleTriggerReminder = () => {
    const notif = notifications[0];
    if (!notif) { toast.info("No notifications found"); return; }
    triggerEscalation.mutate({ notificationId: notif.id, step: "reminder" }, {
      onSuccess: () => toast.success("Reminder triggered"),
      onError: () => toast.error("Failed to trigger reminder"),
    });
  };

  const handleTriggerEscalation = () => {
    const notif = notifications[0];
    if (!notif) { toast.info("No notifications found"); return; }
    triggerEscalation.mutate({ notificationId: notif.id, step: "reroute" }, {
      onSuccess: () => toast.warning("Escalation triggered"),
      onError: () => toast.error("Failed to trigger escalation"),
    });
  };

  const handleReassign = () => {
    const notif = notifications[0];
    if (!notif) { toast.info("No notifications found"); return; }
    triggerEscalation.mutate({ notificationId: notif.id, step: "multi_channel" }, {
      onSuccess: () => toast.success("Multi-channel escalation triggered"),
      onError: () => toast.error("Failed to reassign"),
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
          <Link to="/complaints"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{complaint.id.slice(0, 8)}</span>
            <StatusBadge priority={priorityLabel as never}>{priorityLabel}</StatusBadge>
            <StatusBadge status={statusLabel as never}>{statusLabel}</StatusBadge>
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground">{complaint.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {categoryLabel} · Created {new Date(complaint.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <StatusStepper current={statusLabel as never} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {complaint.aiSummaryStatus === 'completed' && complaint.aiSummary && (
            <div className="rounded-lg border bg-blue-50/50 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Brain className="h-4 w-4" />
                AI Summary
              </div>
              <p className="text-sm text-gray-700">{complaint.aiSummary}</p>
            </div>
          )}
          {(complaint.aiSummaryStatus === 'pending' || (!complaint.aiSummaryStatus && complaint.aiSummary === undefined)) && (
            <div className="rounded-lg border bg-muted/50 p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating AI summary…
            </div>
          )}
          {complaint.aiSummaryStatus === 'failed' && (
            <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Summary unavailable</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => regenerate.mutate(complaint.id)}
                disabled={regenerate.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Regenerate
              </Button>
            </div>
          )}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{complaint.description}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Activity Timeline</h2>
            <ActivityTimeline events={timeline} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Workflow Runs</h2>
            <div className="max-h-80 overflow-y-auto border rounded-md">
              <RunHistory complaintId={complaint.id} />
            </div>
          </motion.div>
        </div>
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Recipient Tracking</h2>
            <RecipientTracker recipients={recipients} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <AIActionPanel
              actions={aiActions}
              onTriggerReminder={handleTriggerReminder}
              onTriggerEscalation={handleTriggerEscalation}
              onReassign={handleReassign}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
