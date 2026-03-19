import { Handle, Position } from '@xyflow/react';
import { Zap, Mail, Edit3, Clock } from 'lucide-react';

export function ActionNode({ data }: { data: any }) {
  const type = data.actionType;
  
  let Icon = Zap;
  let colorClass = "border-slate-500";
  let bgClass = "bg-slate-100";
  let textClass = "text-slate-600";
  let title = "Action";
  let desc = "";

  if (type === 'send_notification') {
    Icon = Zap; title = "Notification"; colorClass = "border-orange-500"; bgClass = "bg-orange-100"; textClass="text-orange-600";
    desc = data.config?.message || '(empty body)';
  } else if (type === 'send_email') {
    Icon = Mail; title = "Email"; colorClass = "border-sky-500"; bgClass = "bg-sky-100"; textClass="text-sky-600";
    desc = data.config?.subject || '(empty subject)';
  } else if (type === 'update_complaint') {
    Icon = Edit3; title = "Update Data"; colorClass = "border-emerald-500"; bgClass = "bg-emerald-100"; textClass="text-emerald-600";
    desc = `Set ${data.config?.field || '?'} = ${data.config?.value || '?'}`;
  } else if (type === 'delay') {
    Icon = Clock; title = "Delay"; colorClass = "border-indigo-500"; bgClass = "bg-indigo-100"; textClass="text-indigo-600";
    desc = `Wait ${data.config?.minutes || 0}m`;
  }

  return (
    <div className={`rounded-md border-2 bg-card p-3 shadow-sm min-w-[200px] ${colorClass}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-full p-1 ${bgClass}`}>
          <Icon className={`h-4 w-4 ${textClass}`} />
        </div>
        <div className="font-semibold text-sm">{title}</div>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
        {desc}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </div>
  );
}
