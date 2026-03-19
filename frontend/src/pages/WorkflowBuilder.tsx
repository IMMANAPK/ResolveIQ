import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReactFlow, Controls, Background, addEdge, applyNodeChanges, applyEdgeChanges, Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflow, useUpdateWorkflow, useCreateWorkflow } from "@/hooks/useWorkflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { NodePalette } from "@/components/workflows/NodePalette";
import { NodeConfigPanel } from "@/components/workflows/NodeConfigPanel";
import { RunHistory } from "@/components/workflows/RunHistory";
import { TriggerNode } from "@/components/workflows/custom-nodes/TriggerNode";
import { AiPromptNode } from "@/components/workflows/custom-nodes/AiPromptNode";
import { ConditionNode } from "@/components/workflows/custom-nodes/ConditionNode";
import { ActionNode } from "@/components/workflows/custom-nodes/ActionNode";

const nodeTypes = {
  trigger: TriggerNode,
  ai_prompt: AiPromptNode,
  condition: ConditionNode,
  action: ActionNode,
};

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: workflow, isLoading } = useWorkflow(isNew ? '' : id || '');
  const updateWorkflow = useUpdateWorkflow();
  const createWorkflow = useCreateWorkflow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'build' | 'history'>('build');

  useEffect(() => {
    if (workflow && !isNew) {
      setName(workflow.name);
      setIsActive(workflow.isActive);
      
      const parsedNodes = workflow.definition.nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position || { x: 100, y: 100 },
        data: { config: n.config, label: n.type, actionType: (n.config as any)?.actionType },
      }));
      
      const parsedEdges = workflow.definition.edges.map((e, i) => ({
        id: `e-${e.from}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        sourceHandle: e.condition || null,
      }));

      setNodes(parsedNodes);
      setEdges(parsedEdges);
    }
  }, [workflow, isNew]);

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow/type');
    if (!type) return;
    
    const actionType = event.dataTransfer.getData('application/reactflow/actionType');
    const position = { x: event.clientX - 250, y: event.clientY - 100 };
    const newNode = {
      id: crypto.randomUUID(),
      type,
      position,
      data: { config: actionType ? { actionType } : {}, actionType },
    };
    setNodes((nds) => nds.concat(newNode));
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleConfigChange = useCallback((nodeId: string, newConfig: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const updatedNode = { ...n, data: { ...n.data, config: newConfig } };
        if (selectedNode?.id === nodeId) setSelectedNode(updatedNode);
        return updatedNode;
      }
      return n;
    }));
  }, [selectedNode]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");

    const apiNodes = nodes.map(n => ({
      id: n.id,
      type: n.type as any,
      config: n.data.config || {},
      position: n.position,
    }));

    const apiEdges = edges.map(e => ({
      from: e.source,
      to: e.target,
      condition: e.sourceHandle as any || undefined,
    }));

    const payload = {
      name,
      isActive,
      description: '',
      definition: {
        schemaVersion: 1,
        nodes: apiNodes,
        edges: apiEdges,
      }
    };

    try {
      if (isNew) {
        const res = await createWorkflow.mutateAsync(payload);
        toast.success("Workflow created");
        navigate(`/admin/workflows/${res.id}`);
      } else {
        await updateWorkflow.mutateAsync({ id: workflow!.id, ...payload });
        toast.success("Workflow updated");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save workflow");
    }
  };

  if (isLoading && !isNew) return <div>Loading...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/workflows')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Workflow Name" 
            className="max-w-xs font-semibold text-lg border-transparent hover:border-input focus:border-input"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-muted p-1 rounded-md">
             <Button variant={activeTab === 'build' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveTab('build')}>Builder</Button>
             {!isNew && <Button variant={activeTab === 'history' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveTab('history')}>Run History</Button>}
          </div>
          <div className="flex items-center gap-2 border-l pl-4">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm font-medium">Active</span>
          </div>
          <Button onClick={handleSave} disabled={createWorkflow.isPending || updateWorkflow.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {activeTab === 'build' ? (
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-muted/10"
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
          <NodeConfigPanel selectedNode={selectedNode} onChange={handleConfigChange} />
        </div>
      ) : (
        <div className="flex flex-1 bg-muted/10 justify-center">
           <div className="w-full max-w-4xl bg-card border-x flex flex-col">
              <div className="p-4 border-b font-medium">Workflow Runs</div>
              {workflow && <RunHistory workflowId={workflow.id} />}
           </div>
        </div>
      )}
    </div>
  );
}
