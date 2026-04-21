import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NodeConfigPanel({ selectedNode, onChange }: { selectedNode: any; onChange: (id: string, config: any) => void }) {
  if (!selectedNode) {
    return (
      <aside className="w-80 border-l bg-muted/20 p-4 shrink-0 flex items-center justify-center text-muted-foreground text-sm">
        Select a node to configure
      </aside>
    );
  }

  const { id, type, data } = selectedNode;
  const config = data.config || {};
  const actionType = data.actionType;

  const updateConfig = (key: string, value: any) => {
    onChange(id, { ...config, [key]: value });
  };

  return (
    <aside className="w-80 border-l bg-card p-4 shrink-0 overflow-y-auto">
      <div className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
        Configuration
      </div>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Node ID</Label>
          <div className="text-xs font-mono bg-muted/50 p-1.5 rounded truncate">{id}</div>
        </div>

        {type === 'trigger' && (
          <div className="space-y-2">
            <Label>Trigger Event</Label>
            <Select value={config.event || 'manual'} onValueChange={v => updateConfig('event', v === 'manual' ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Manual run" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual run</SelectItem>
                <SelectItem value="complaint.created">Complaint Created</SelectItem>
                <SelectItem value="complaint.status_changed">Status Changed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {type === 'ai_prompt' && (
          <>
            <div className="space-y-2">
              <Label>Prompt Slug</Label>
              <Input placeholder="e.g. summarize" value={config.promptSlug || ''} onChange={e => updateConfig('promptSlug', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Output Variable</Label>
              <Input placeholder="ai_output" value={config.outputVar || ''} onChange={e => updateConfig('outputVar', e.target.value)} />
            </div>
          </>
        )}

        {type === 'condition' && (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Input placeholder="e.g. complaint.priority" value={config.field || ''} onChange={e => updateConfig('field', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={config.op || ''} onValueChange={v => updateConfig('op', v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eq">=</SelectItem>
                    <SelectItem value="neq">!=</SelectItem>
                    <SelectItem value="gt">&gt;</SelectItem>
                    <SelectItem value="lt">&lt;</SelectItem>
                    <SelectItem value="contains">Has</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input value={config.value || ''} onChange={e => updateConfig('value', e.target.value)} />
              </div>
            </div>
          </>
        )}

        {type === 'action' && actionType === 'send_notification' && (
          <>
            <div className="space-y-2">
              <Label>Recipient IDs</Label>
              <Input value={(config.recipientIds || []).join(',')} onChange={e => updateConfig('recipientIds', e.target.value.split(',').map((s: string)=>s.trim()))} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Input value={config.message || ''} onChange={e => updateConfig('message', e.target.value)} />
            </div>
          </>
        )}

        {type === 'action' && actionType === 'send_email' && (
          <>
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={config.to || ''} onChange={e => updateConfig('to', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={config.subject || ''} onChange={e => updateConfig('subject', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Input value={config.body || ''} onChange={e => updateConfig('body', e.target.value)} />
            </div>
          </>
        )}

        {type === 'action' && actionType === 'update_complaint' && (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Input placeholder="e.g. status" value={config.field || ''} onChange={e => updateConfig('field', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={config.value || ''} onChange={e => updateConfig('value', e.target.value)} />
            </div>
          </>
        )}

        {type === 'action' && actionType === 'delay' && (
          <div className="space-y-2">
            <Label>Minutes</Label>
            <Input type="number" value={config.minutes || 0} onChange={e => updateConfig('minutes', Number(e.target.value))} />
          </div>
        )}
      </div>
    </aside>
  );
}
