import { useState, useEffect } from 'react';
import { useUpdateComplaintStatus } from '@/hooks/useComments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open:        ['assigned', 'in_progress', 'resolved', 'closed'],
  assigned:    ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved:    ['closed'],
  closed:      [],
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

interface Props {
  complaintId: string;
  currentStatus: string;
}

export function StatusUpdatePanel({ complaintId, currentStatus }: Props) {
  const updateStatus = useUpdateComplaintStatus(complaintId);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(false);

  const isFinal = (s: string) => s === 'resolved' || s === 'closed';

  useEffect(() => {
    setNotify(isFinal(status));
  }, [status]);

  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];
  const isClosed = currentStatus === 'closed';

  const handleSave = () => {
    if (!status) return;
    updateStatus.mutate(
      { status, resolutionNotes: notes || undefined, notifyComplainant: notify },
      {
        onSuccess: () => {
          toast.success('Status updated');
          setStatus('');
          setNotes('');
        },
        onError: () => toast.error('Failed to update status'),
      },
    );
  };

  if (isClosed) {
    return (
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">Status</h2>
        <p className="text-sm text-muted-foreground">This complaint is closed.</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Update Status</h2>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">New status</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {transitions.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
      </div>

      {(status === 'resolved' || status === 'closed') && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Resolution notes</label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe what was done…"
            rows={3}
            maxLength={2000}
          />
        </div>
      )}

      {status && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={e => setNotify(e.target.checked)}
            className="rounded"
          />
          Notify complainant by email
        </label>
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={!status || updateStatus.isPending}
        onClick={handleSave}
      >
        {updateStatus.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
