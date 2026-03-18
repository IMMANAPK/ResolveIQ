import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCommittees, useCreateCommittee, useUpdateCommittee, useDeleteCommittee } from "@/hooks/useCommittees";
import { useUsers } from "@/hooks/useUsers";
import type { ApiCommittee, ApiComplaintCategory } from "@/types/api";
import { CATEGORY_LABELS } from "@/types/api";
import { toast } from "sonner";

const ALL_CATEGORIES: ApiComplaintCategory[] = ['hr', 'it', 'facilities', 'conduct', 'safety', 'other'];

const CATEGORY_COLORS: Record<ApiComplaintCategory, string> = {
  hr: 'bg-blue-100 text-blue-700',
  it: 'bg-violet-100 text-violet-700',
  facilities: 'bg-orange-100 text-orange-700',
  conduct: 'bg-red-100 text-red-700',
  safety: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-600',
};

interface CommitteeFormData {
  name: string;
  description: string;
  categories: ApiComplaintCategory[];
  managerId: string;
}

const EMPTY_FORM: CommitteeFormData = {
  name: '',
  description: '',
  categories: [],
  managerId: 'none',
};

function CommitteeDialog({
  open,
  onClose,
  initial,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ApiCommittee;
  onSave: (data: CommitteeFormData) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<CommitteeFormData>(
    initial
      ? { name: initial.name, description: initial.description ?? '', categories: initial.categories, managerId: initial.managerId ?? 'none' }
      : EMPTY_FORM,
  );

  const { data: users = [] } = useUsers();
  const managers = users.filter((u) => u.roles.includes('manager'));

  function toggleCategory(cat: ApiComplaintCategory) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Committee' : 'New Committee'}</DialogTitle>
          <DialogDescription>
            {initial ? 'Update committee details, category mapping, and manager.' : 'Create a new committee and assign complaint categories to it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Committee Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. General Committee"
            />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What types of complaints does this committee handle?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Complaint Categories Handled</Label>
            <p className="text-xs text-muted-foreground">Select categories — complaints in these categories will be routed here directly (no AI needed).</p>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const selected = form.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border-2 transition-all ${
                      selected
                        ? `${CATEGORY_COLORS[cat]} border-current`
                        : 'bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Assigned Manager</Label>
            <Select
              value={form.managerId}
              onValueChange={(v) => setForm((f) => ({ ...f, managerId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a manager (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No manager assigned —</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName} ({m.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">This manager will be notified when complaints are escalated.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name.trim() || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? 'Save Changes' : 'Create Committee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CommitteeSettings() {
  const { data: committees = [], isLoading } = useCommittees();
  const { data: users = [] } = useUsers();
  const createCommittee = useCreateCommittee();
  const updateCommittee = useUpdateCommittee();
  const deleteCommittee = useDeleteCommittee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiCommittee | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ApiCommittee | undefined>();

  function openCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(c: ApiCommittee) {
    setEditTarget(c);
    setDialogOpen(true);
  }

  async function handleSave(data: CommitteeFormData) {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      categories: data.categories,
      managerId: (data.managerId && data.managerId !== 'none') ? data.managerId : undefined,
    };

    try {
      if (editTarget) {
        await updateCommittee.mutateAsync({ id: editTarget.id, ...payload });
        toast.success('Committee updated');
      } else {
        await createCommittee.mutateAsync(payload);
        toast.success('Committee created');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save committee');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCommittee.mutateAsync(deleteTarget.id);
      toast.success('Committee deleted');
    } catch {
      toast.error('Failed to delete committee');
    } finally {
      setDeleteTarget(undefined);
    }
  }

  // Build a quick map of category → committee name for the mapping table
  const categoryMap: Partial<Record<ApiComplaintCategory, string>> = {};
  committees.forEach((c) => {
    c.categories?.forEach((cat) => { categoryMap[cat] = c.name; });
  });

  const unmappedCategories = ALL_CATEGORIES.filter((c) => !categoryMap[c]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Committee Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage committees, assign managers, and map complaint categories.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Committee
        </Button>
      </div>

      {/* Category mapping overview */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Category → Committee Mapping</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className={categoryMap[cat] ? 'font-medium' : 'text-muted-foreground italic'}>
                {categoryMap[cat] ?? 'AI routing'}
              </span>
            </div>
          ))}
        </div>
        {unmappedCategories.length > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-1.5">
            {unmappedCategories.map((c) => CATEGORY_LABELS[c]).join(', ')} — not mapped to any committee, will use AI routing as fallback.
          </p>
        )}
      </div>

      {/* Committee cards */}
      {committees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="font-medium">No committees yet</p>
          <Button variant="outline" onClick={openCreate}>Create your first committee</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {committees.map((c) => {
            const memberCount = users.filter(
              (u) => u.roles.includes('committee_member') && u.department?.toLowerCase() === c.name.toLowerCase(),
            ).length;

            return (
              <div key={c.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1">
                  {c.categories?.length > 0 ? c.categories.map((cat) => (
                    <span key={cat} className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                  )) : (
                    <span className="text-xs text-muted-foreground italic">No categories mapped</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                  </span>
                  <span>
                    Manager: {c.manager?.fullName ?? <em>Unassigned</em>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <CommitteeDialog
        key={dialogOpen ? (editTarget?.id ?? 'new') : 'closed'}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editTarget}
        onSave={handleSave}
        isSaving={createCommittee.isPending || updateCommittee.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the committee and its category mappings. Existing complaints will still be resolved by AI routing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
