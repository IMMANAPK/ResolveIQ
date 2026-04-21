import { Handle, Position } from '@xyflow/react';
import { Split } from 'lucide-react';

export function ConditionNode({ data }: { data: any }) {
  return (
    <div className="rounded-md border-2 border-yellow-500 bg-card p-3 shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-full bg-yellow-100 p-1">
          <Split className="h-4 w-4 text-yellow-600" />
        </div>
        <div className="font-semibold text-sm">Condition</div>
      </div>
      <div className="text-xs text-muted-foreground">
        If {data.config?.field || '?'} {data.config?.op || '?'} {data.config?.value || '?'}
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-green-500 -ml-8" />
      <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-red-500 ml-8" />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-4 px-2 font-medium">
        <span className="text-green-600">True</span>
        <span className="text-red-600">False</span>
      </div>
    </div>
  );
}
