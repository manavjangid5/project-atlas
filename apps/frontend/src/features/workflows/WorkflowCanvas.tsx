import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";
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
import NodeConfigPanel from "./NodeConfigPanel";
import RunHistoryPanel from "./RunHistoryPanel";
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
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );
  useEffect(() => {
    function handleDeleteEvent(e: Event) {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) handleNodeDelete(nodeId);
    }
    window.addEventListener("atlas-delete-node", handleDeleteEvent);
    return () => window.removeEventListener("atlas-delete-node", handleDeleteEvent);
  }, []);
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

  function onNodeClick(_e: React.MouseEvent, node: Node) {
    setSelectedNode(node);
    setShowRuns(false);
  }

  function handleNodeConfigSave(nodeId: string, config: Record<string, any>) {
  // console.log("[WorkflowCanvas] handleNodeConfigSave called:", nodeId, config);
  setNodes((nds) => {
    const updated = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config } } : n));
    // console.log("[WorkflowCanvas] nodes after update:", updated.map(n => ({ id: n.id, config: n.data.config })));
    return updated;
  });
}

  function handleNodeDelete(nodeId: string) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }

  async function handleSave() {
  setSaving(true);
  // console.log("[WorkflowCanvas] Saving graph, nodes:", nodes.map(n => ({ id: n.id, config: n.data.config })));
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
    setShowRuns(true);
    setSelectedNode(null);
  }

  return (
    <div className="flex h-full">
      <NodePalette />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{workflow.name}</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => { setShowRuns(!showRuns); setSelectedNode(null); }}
            >
              {showRuns ? "Hide Runs" : "View Runs"}
            </Button>
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
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            deleteKeyCode={["Delete", "Backspace"]}
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

      {selectedNode && (
        <NodeConfigPanel
          key={selectedNode.id}
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={handleNodeConfigSave}
          onDelete={handleNodeDelete}
        />
      )}
      {showRuns && !selectedNode && <RunHistoryPanel workflowId={workflow.id} />}
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