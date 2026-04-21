import { Play, Bot, Split, Zap, Mail, Edit3, Clock } from "lucide-react";

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string, actionType?: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    if (actionType) {
      event.dataTransfer.setData('application/reactflow/actionType', actionType);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const paletteItems = [
    { type: 'trigger', icon: Play, label: 'Trigger Event', color: 'text-blue-600', bg: 'bg-blue-100' },
    { type: 'ai_prompt', icon: Bot, label: 'AI Prompt', color: 'text-purple-600', bg: 'bg-purple-100' },
    { type: 'condition', icon: Split, label: 'Condition', color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { type: 'action', actionType: 'send_notification', icon: Zap, label: 'Notification', color: 'text-orange-600', bg: 'bg-orange-100' },
    { type: 'action', actionType: 'send_email', icon: Mail, label: 'Email', color: 'text-sky-600', bg: 'bg-sky-100' },
    { type: 'action', actionType: 'update_complaint', icon: Edit3, label: 'Update Data', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { type: 'action', actionType: 'delay', icon: Clock, label: 'Delay', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  ];

  return (
    <aside className="w-56 border-r bg-muted/20 p-4 shrink-0 overflow-y-auto">
      <div className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
        Nodes
      </div>
      <div className="space-y-3">
        {paletteItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-md border bg-card p-3 shadow-sm cursor-grab hover:border-primary transition-colors"
            draggable
            onDragStart={(e) => onDragStart(e, item.type, item.actionType)}
          >
            <div className={`rounded-full p-1.5 ${item.bg}`}>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
