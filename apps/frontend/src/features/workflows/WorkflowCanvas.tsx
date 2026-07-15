import { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import NodePalette from "./NodePalette";
import CustomNode from "./CustomNode";
import { Button } from "../../components/Button";
import { updateWorkflowGraph, runWorkflow } from "./workflowsApi";
import type { Workflow } from "./workflowTypes";

const nodeTypes = { custom: CustomNode };

interface Props {
  workflow: Workflow;
}

function CanvasInner({ workflow }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.graph.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.graph.edges as Edge[]);
  const [saving, setSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/atlas-node");
    if (!raw) return;
    const { kind, label } = JSON.parse(raw);

    const bounds = reactFlowWrapper.current!.getBoundingClientRect();
    const position = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };

    idCounter.current += 1;
    const newNode: Node = {
      id: `node-${Date.now()}-${idCounter.current}`,
      type: "custom",
      position,
      data: { label, kind, config: {} },
    };
    setNodes((nds) => nds.concat(newNode));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateWorkflowGraph(workflow.id, {
        nodes: nodes as any,
        edges: edges as any,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    await handleSave();
    await runWorkflow(workflow.id);
  }

  return (
    <div className="flex h-full">
      <NodePalette />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{workflow.name}</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button onClick={handleRun}>Run</Button>
          </div>
        </div>
        <div className="flex-1" ref={reactFlowWrapper} onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#2A2A2A" gap={20} />
            <Controls />
            <MiniMap
              nodeColor="#E8622C"
              maskColor="rgba(10,10,11,0.8)"
              style={{ backgroundColor: "#161616" }}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}