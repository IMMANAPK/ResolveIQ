import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { StatusStepper } from "@/components/cms/StatusStepper";
import { RecipientTracker } from "@/components/cms/RecipientTracker";
import { AIActionPanel } from "@/components/cms/AIActionPanel";
import { ActivityTimeline } from "@/components/cms/ActivityTimeline";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => apiFetch<any>(`/complaints/${id}`),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => 
      apiFetch(`/complaints/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      toast.success("Status updated");
    }
  });

  const triggerEscalationMutation = useMutation({
    mutationFn: (step: string) => {
      const latestNotif = complaint?.notifications?.[0];
      if (!latestNotif) throw new Error("No notification found to escalate");
      return apiFetch(`/escalation/notification/${latestNotif.id}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ step }),
      });
    },
    onSuccess: () => {
      toast.success("Escalation step triggered");
      // History might take a second to update via BullMQ
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['complaint', id] }), 2000);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to trigger escalation");
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-foreground">Complaint not found</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/complaints">← Back to Complaints</Link>
        </Button>
      </div>
    );
  }

  // Map recipients from latest notification
  const latestNotif = complaint.notifications?.[0];
  const recipients = latestNotif?.recipients?.map((r: any) => ({
    name: r.recipient?.fullName || `User ${r.recipientId.split('-')[0]}`,
    seen: r.isRead,
    time: r.readAt ? new Date(r.readAt).toLocaleTimeString() : undefined
  })) || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
            <Link to="/complaints"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground tabular-nums truncate max-w-[150px]">{complaint.id}</span>
              <StatusBadge priority={complaint.priority}>{complaint.priority}</StatusBadge>
              <StatusBadge status={complaint.status}>{complaint.status}</StatusBadge>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-foreground">{complaint.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {complaint.category} · Created {new Date(complaint.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {complaint.status !== 'resolved' && (
            <Button 
              size="sm" 
              className="gap-2"
              onClick={() => updateStatusMutation.mutate('resolved')}
              disabled={updateStatusMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" /> Mark Resolved
            </Button>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <StatusStepper current={complaint.status} />
      </motion.div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{complaint.description}</p>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
              <span>Raised by: <span className="font-medium text-foreground">{complaint.raisedBy?.fullName || 'Anonymous'}</span></span>
            </div>
          </motion.div>

          {/* Activity Timeline */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Activity Timeline</h2>
            <ActivityTimeline events={complaint.timeline || []} />
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recipient Tracking */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Recipient Tracking</h2>
            {recipients.length > 0 ? (
              <RecipientTracker recipients={recipients} />
            ) : (
              <p className="text-xs text-muted-foreground italic">No notification recipients tracked yet.</p>
            )}
          </motion.div>

          {/* AI Actions */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <AIActionPanel
              actions={complaint.aiActions || []}
              onTriggerReminder={() => triggerEscalationMutation.mutate('reminder')}
              onTriggerEscalation={() => triggerEscalationMutation.mutate('multi_channel')}
              onReassign={() => triggerEscalationMutation.mutate('reroute')}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
