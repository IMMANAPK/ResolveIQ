import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

export function TriggerNode({ data }: { data: any }) {
  return (
    <div className="rounded-md border-2 border-blue-500 bg-card p-3 shadow-sm min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-full bg-blue-100 p-1">
          <Play className="h-4 w-4 text-blue-600" />
        </div>
        <div className="font-semibold text-sm">Trigger</div>
      </div>
      <div className="text-xs text-muted-foreground">
        Event: {data.config?.event || 'Manual'}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
    </div>
  );
}
