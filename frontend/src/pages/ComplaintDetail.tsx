import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { StatusStepper } from "@/components/cms/StatusStepper";
import { RecipientTracker } from "@/components/cms/RecipientTracker";
import { AIActionPanel } from "@/components/cms/AIActionPanel";
import { ActivityTimeline } from "@/components/cms/ActivityTimeline";
import { complaints } from "@/data/mock";
import type { AIAction, TimelineEvent, Recipient } from "@/data/mock";
import { toast } from "sonner";

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const complaint = complaints.find(c => c.id === id);

  const [aiActions, setAiActions] = useState<AIAction[]>(complaint?.aiActions ?? []);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(complaint?.timeline ?? []);
  const [recipients, setRecipients] = useState<Recipient[]>(complaint?.recipients ?? []);

  const triggerReminder = useCallback(() => {
    const pending = recipients.find(r => !r.seen);
    if (!pending) { toast.info("All recipients have viewed"); return; }
    const now = new Date().toISOString();
    setAiActions(prev => [...prev, { id: `ai-${Date.now()}`, type: "reminder", message: `AI Reminder Sent to ${pending.name} (Polite Tone)`, timestamp: now, tone: "Polite" }]);
    setTimeline(prev => [...prev, { id: `t-${Date.now()}`, type: "reminder", description: `AI Reminder sent to ${pending.name}`, timestamp: now }]);
    toast.success(`Reminder sent to ${pending.name}`);
  }, [recipients]);

  const triggerEscalation = useCallback(() => {
    const now = new Date().toISOString();
    setAiActions(prev => [...prev, { id: `ai-${Date.now()}`, type: "escalation", message: "Escalation Triggered — Unresponsive members", timestamp: now }]);
    setTimeline(prev => [...prev, { id: `t-${Date.now()}`, type: "escalation", description: "Escalation triggered by admin", timestamp: now }]);
    toast.warning("Escalation triggered");
  }, []);

  const reassign = useCallback(() => {
    const pending = recipients.find(r => !r.seen);
    if (!pending) { toast.info("All recipients have viewed"); return; }
    const now = new Date().toISOString();
    const newName = "Maria Lopez";
    setRecipients(prev => prev.map(r => r.name === pending.name ? { ...r, name: newName, seen: false } : r));
    setAiActions(prev => [...prev, { id: `ai-${Date.now()}`, type: "reassignment", message: `Reassigned from ${pending.name} to ${newName}`, timestamp: now }]);
    setTimeline(prev => [...prev, { id: `t-${Date.now()}`, type: "reassignment", description: `Reassigned from ${pending.name} to ${newName}`, timestamp: now }]);
    toast.success(`Reassigned to ${newName}`);
  }, [recipients]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
          <Link to="/complaints"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{complaint.id}</span>
            <StatusBadge priority={complaint.priority}>{complaint.priority}</StatusBadge>
            <StatusBadge status={complaint.status}>{complaint.status}</StatusBadge>
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground">{complaint.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {complaint.category} · Created {new Date(complaint.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
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
          </motion.div>

          {/* Activity Timeline */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Activity Timeline</h2>
            <ActivityTimeline events={timeline} />
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recipient Tracking */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Recipient Tracking</h2>
            <RecipientTracker recipients={recipients} />
          </motion.div>

          {/* AI Actions */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <AIActionPanel
              actions={aiActions}
              onTriggerReminder={triggerReminder}
              onTriggerEscalation={triggerEscalation}
              onReassign={reassign}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
