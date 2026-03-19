import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationRules, useCreateNotificationRule, useDeleteNotificationRule } from "@/hooks/useNotificationRules";
import { toast } from "sonner";

export function NotificationRulesSection({ committeeId }: { committeeId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: rules = [], isLoading } = useNotificationRules(committeeId);
  const createRule = useCreateNotificationRule(committeeId);
  const deleteRule = useDeleteNotificationRule(committeeId);

  const [ruleType, setRuleType] = useState<'default' | 'conditional'>('default');
  const [field, setField] = useState<'priority' | 'category'>('priority');
  const [op, setOp] = useState<'eq' | 'neq'>('eq');
  const [val, setVal] = useState<string>('high');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  async function handleCreate() {
    try {
      await createRule.mutateAsync({
        type: ruleType,
        condition: ruleType === 'conditional' ? { field, op, value: val } : undefined,
        recipientUserIds: selectedUsers,
        recipientRoles: selectedRoles,
        order: rules.length,
      });
      toast.success("Rule created");
      setDialogOpen(false);
    } catch {
      toast.error("Failed to create rule");
    }
  }

  return (
    <div className="border-t pt-3 mt-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full text-sm font-medium text-left">
        <span>Notification Rules ({rules.length})</span>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {isLoading ? <div className="text-xs text-muted-foreground">Loading...</div> : rules.map(rule => (
            <div key={rule.id} className="text-xs border rounded p-2 flex items-center justify-between bg-muted/10">
               <div className="flex items-center gap-2">
                  <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                  <div>
                    <span className="font-semibold">{rule.type === 'default' ? 'Default' : 'Conditional'}</span>
                    {rule.type === 'conditional' && rule.condition && (
                      <span className="text-muted-foreground ml-1">
                        (If {rule.condition.field} {rule.condition.op === 'eq' ? '=' : '≠'} {rule.condition.value})
                      </span>
                    )}
                    <div className="text-muted-foreground mt-0.5">
                       {rule.recipientUserIds.length} Users, {rule.recipientRoles.length} Roles
                    </div>
                  </div>
               </div>
               <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                 <Trash2 className="h-3 w-3" />
               </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Rule
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Notification Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select value={ruleType} onValueChange={(v: any) => setRuleType(v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Rule</SelectItem>
                  <SelectItem value="conditional">Conditional Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ruleType === 'conditional' && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Field</Label>
                  <Select value={field} onValueChange={(v: any) => setField(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Operator</Label>
                  <Select value={op} onValueChange={(v: any) => setOp(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">Equals</SelectItem>
                      <SelectItem value="neq">Not Equals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input className="h-8 text-xs" value={val} onChange={e => setVal(e.target.value)} placeholder="e.g. high" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Recipients (Users) — Comma separated IDs</Label>
              <Input
                placeholder="User IDs, comma separated"
                value={selectedUsers.join(', ')}
                onChange={e => setSelectedUsers(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipients (Roles) — Comma separated roles</Label>
              <Input
                placeholder="e.g. admin, manager"
                value={selectedRoles.join(', ')}
                onChange={e => setSelectedRoles(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
