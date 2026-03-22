import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useFeedback, useSubmitFeedback } from "@/hooks/useFeedback";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "@/hooks/useAttachments";
import { AttachmentGrid } from "@/components/cms/AttachmentGrid";
import { FileDropzone } from "@/components/cms/FileDropzone";
import { StarRating } from "@/components/cms/StarRating";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { SentimentBadge } from "@/components/cms/SentimentBadge";
import { SlaBadge } from "@/components/cms/SlaBadge";
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
import { CommentThread } from '@/components/cms/CommentThread';
import { StatusUpdatePanel } from '@/components/cms/StatusUpdatePanel';

function buildRecipients(notifications: ApiNotification[]): Recipient[] {
  const seen = new Map<string, Recipient>();
  for (const notif of notifications) {
    for (const r of notif.recipients) {
      // Backend entity uses `recipient` (User relation) and `recipientId` (FK)
      const name = r.recipient?.fullName ?? r.recipientId ?? "Unknown";
      const time = r.readAt
        ? new Date(r.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : undefined;
      const key = r.recipientId ?? r.id;
      if (!seen.has(key)) {
        seen.set(key, { name, seen: r.isRead, time });
      } else if (r.isRead && !seen.get(key)!.seen) {
        seen.set(key, { name, seen: true, time });
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
        events.push({ id: "viewed-" + r.id, type: "viewed", description: "Viewed by " + (r.recipient?.fullName ?? r.recipientId ?? "Unknown"), timestamp: r.readAt, user: r.recipient?.fullName });
      }
    }
  }
  const ESC_STEP_LABELS: Record<string, string> = {
    reminder: "AI Reminder Sent",
    reroute: "Complaint Re-routed",
    multi_channel: "Critical Multi-Channel Alert",
  };
  for (const esc of escalations) {
    const label = ESC_STEP_LABELS[esc.step] ?? `Escalation: ${esc.step}`;
    const aiNote = esc.aiGeneratedSubject ? ` — "${esc.aiGeneratedSubject}"` : esc.metadata?.aiReason ? ` — ${esc.metadata.aiReason}` : '';
    const statusNote = esc.status === 'failed' ? ' (failed)' : '';
    events.push({ id: "esc-" + esc.id, type: "escalation", description: label + aiNote + statusNote, timestamp: esc.createdAt });
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
  const ESC_ACTION_LABELS: Record<string, string> = {
    reminder: "AI sent a smart reminder email",
    reroute: "AI re-routed complaint to available members",
    multi_channel: "AI triggered critical multi-channel alert",
  };
  for (const esc of escalations) {
    const message = ESC_ACTION_LABELS[esc.step] ?? `Escalation: ${esc.step}`;
    const detail = esc.metadata?.aiReason ? ` (${esc.metadata.aiReason})` : '';
    actions.push({ id: "ai-esc-" + esc.id, type: "escalation", message: message + detail, timestamp: esc.createdAt });
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

  const { user } = useAuth();
  const { data: feedback, isLoading: loadingFeedback } = useFeedback(id!);
  const submitFeedback = useSubmitFeedback(id!);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");

  const { data: attachments = [] } = useAttachments(id!);
  const uploadAttachment = useUploadAttachment(id!);
  const deleteAttachment = useDeleteAttachment(id!);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const isAdmin = user?.roles?.includes('admin');
  const canUpload = attachments.length < 3;

  const isLoading = loadingComplaint || loadingNotifs || loadingEsc || loadingFeedback;

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
            {complaint.sentimentLabel && (
              <SentimentBadge label={complaint.sentimentLabel} score={complaint.sentimentScore} />
            )}
            {complaint.slaDeadline && (
              <SlaBadge
                slaDeadline={complaint.slaDeadline}
                slaBreached={complaint.slaBreached}
                slaBreachedAt={complaint.slaBreachedAt}
                createdAt={complaint.createdAt}
                status={complaint.status}
              />
            )}
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
          {complaint.aiSummaryStatus === 'pending' && (
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
            <h2 className="mb-4 text-sm font-semibold text-foreground">Discussion</h2>
            <CommentThread
              complaintId={complaint.id}
              isClosed={complaint.status === 'closed'}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Activity Timeline</h2>
            <ActivityTimeline events={timeline} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Workflow Runs</h2>
            <div className="max-h-80 overflow-y-auto border rounded-md">
              <RunHistory complaintId={complaint.id} complaintTitle={complaint.title} />
            </div>
          </motion.div>

          {/* Feedback Section */}
          {complaint.status === 'resolved' || complaint.status === 'closed' ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Resolution Feedback</h2>
              {feedback ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StarRating value={feedback.rating} readonly size="md" />
                    <span className="text-sm text-muted-foreground">{feedback.rating}/5</span>
                  </div>
                  {feedback.comment && (
                    <p className="text-sm text-muted-foreground">{feedback.comment}</p>
                  )}
                  {feedback.aiSummary && (
                    <div className="rounded-lg border bg-blue-50/50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 mb-1">
                        <Brain className="h-3.5 w-3.5" />
                        AI Summary
                      </div>
                      <p className="text-xs text-gray-700">{feedback.aiSummary}</p>
                    </div>
                  )}
                </div>
              ) : complaint.raisedById === user?.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (feedbackRating === 0) return;
                    submitFeedback.mutate(
                      { rating: feedbackRating, comment: feedbackComment || undefined },
                      {
                        onSuccess: () => {
                          toast.success("Feedback submitted!");
                          setFeedbackRating(0);
                          setFeedbackComment("");
                        },
                        onError: () => toast.error("Failed to submit feedback"),
                      }
                    );
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">How satisfied are you with the resolution?</label>
                    <StarRating value={feedbackRating} onChange={setFeedbackRating} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Comments (optional)</label>
                    <Textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Share your experience..."
                      rows={3}
                      maxLength={2000}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={feedbackRating === 0 || submitFeedback.isPending}
                  >
                    {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              )}
            </motion.div>
          ) : null}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="card-surface p-5"
          >
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Attachments ({attachments.length}/3)
            </h2>
            <AttachmentGrid
              attachments={attachments}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onDelete={(attachmentId) =>
                deleteAttachment.mutate(attachmentId, {
                  onError: () => toast.error("Failed to delete attachment"),
                })
              }
              deleting={deleteAttachment.isPending}
            />
            {canUpload && (
              <div className="mt-3 space-y-2">
                <FileDropzone
                  files={pendingFiles}
                  onChange={setPendingFiles}
                  maxFiles={3 - attachments.length}
                />
                {pendingFiles.length > 0 && (
                  <button
                    className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    disabled={uploadAttachment.isPending}
                    onClick={async () => {
                      for (const file of pendingFiles) {
                        await uploadAttachment.mutateAsync(file).catch(() => {
                          toast.error(`Failed to upload ${file.name}`);
                        });
                      }
                      setPendingFiles([]);
                      toast.success("Files uploaded");
                    }}
                  >
                    {uploadAttachment.isPending ? "Uploading..." : `Upload ${pendingFiles.length} file(s)`}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Recipient Tracking</h2>
            <RecipientTracker recipients={recipients} />
          </motion.div>
          {(isAdmin || user?.roles?.some(r => ['manager', 'committee_member'].includes(r))) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <StatusUpdatePanel
                complaintId={complaint.id}
                currentStatus={complaint.status}
              />
            </motion.div>
          )}
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
