import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';

export function AiPromptNode({ data }: { data: any }) {
  return (
    <div className="rounded-md border-2 border-purple-500 bg-card p-3 shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-full bg-purple-100 p-1">
          <Bot className="h-4 w-4 text-purple-600" />
        </div>
        <div className="font-semibold text-sm">AI Prompt</div>
      </div>
      <div className="text-xs text-muted-foreground">
        Prompt: {data.config?.promptSlug || '(none)'}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500" />
    </div>
  );
}
