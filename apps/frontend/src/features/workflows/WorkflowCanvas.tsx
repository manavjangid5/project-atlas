import { useCallback, useEffect, useRef, useState } from "react";
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
import VersionsPanel from "./VersionsPanel";
import { Button } from "../../components/Button";
import { updateWorkflowGraph, runWorkflow } from "./workflowsApi";
import type { Workflow, WorkflowGraph } from "./workflowTypes";
import type { WorkflowNodeData } from "./workflowTypes";
const nodeTypes = { custom: CustomNode };

interface Props {
  workflow: Workflow;
}
interface BranchEdgeData {
  branch?: "true" | "false";
}

function CanvasInner({ workflow }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>(workflow.graph.nodes as Node<WorkflowNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow.graph.edges as Edge[],
  );
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  
  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  useEffect(() => {
    function handleDeleteEvent(e: Event) {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) handleNodeDelete(nodeId);
    }
    window.addEventListener("atlas-delete-node", handleDeleteEvent);
    return () => window.removeEventListener("atlas-delete-node", handleDeleteEvent);
  }, [handleNodeDelete]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const isConditional = sourceNode?.data?.kind === "conditional";

      const edge: Edge<BranchEdgeData> = {
        ...connection,
        id: `${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        data: isConditional
          ? {
              branch:
                connection.sourceHandle === "false" ? "false" : "true",
            }
          : undefined,
      };

      setEdges((eds) => addEdge(edge, eds));
    },
    [nodes, setEdges]
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

  function onNodeClick(_e: React.MouseEvent, node: Node) {
    setSelectedNode(node);
    setShowRuns(false);
    setShowVersions(false);
  }

  function handleNodeConfigSave(nodeId: string, config: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config } } : n))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateWorkflowGraph(workflow.id, {
        nodes: nodes as unknown as WorkflowGraph["nodes"],
        edges: edges as unknown as WorkflowGraph["edges"],
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    await handleSave();
    await runWorkflow(workflow.id);
    setShowRuns(true);
    setShowVersions(false);
    setSelectedNode(null);
  }

  function toggleRuns() {
    setShowRuns(!showRuns);
    setShowVersions(false);
    setSelectedNode(null);
  }

  function toggleVersions() {
    setShowVersions(!showVersions);
    setShowRuns(false);
    setSelectedNode(null);
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <NodePalette />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{workflow.name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              Webhook: {import.meta.env.VITE_API_URL}/webhooks/{workflow.webhookToken}
            </span>
            <Button variant="secondary" onClick={toggleVersions}>
              {showVersions ? "Hide Versions" : "Versions"}
            </Button>
            <Button variant="secondary" onClick={toggleRuns}>
              {showRuns ? "Hide Runs" : "View Runs"}
            </Button>
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button onClick={handleRun}>Run</Button>
          </div>
        </div>
        <div
          className="flex-1 min-h-0 overflow-hidden"
          ref={reactFlowWrapper}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
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
      {showRuns && !selectedNode && (
        <RunHistoryPanel workflowId={workflow.id} />
      )}
      {showVersions && !selectedNode && (
        <VersionsPanel
          workflowId={workflow.id}
          onRestored={() => window.location.reload()}
        />
      )}
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
