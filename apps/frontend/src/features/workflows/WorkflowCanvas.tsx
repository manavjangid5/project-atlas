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
import { validateGraph } from "./graphValidation";
import { api } from "../../lib/api";
import { useGraphHistory } from "./useGraphHistory";
import { AxiosError } from "axios";

const nodeTypes = { custom: CustomNode };
interface Props {
  workflow: Workflow;
  onSaved?: (workflow: Workflow) => void;
}
interface BranchEdgeData {
  branch?: "true" | "false";
}

function CanvasInner({ workflow, onSaved }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>(
    workflow.graph.nodes as Node<WorkflowNodeData>[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow.graph.edges as Edge[],
  );
  const [saving, setSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const [showRuns, setShowRuns] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const [suggestions, setSuggestions] = useState<
    { kind: string; label: string; reason: string }[]
  >([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const { pushHistory, undo, redo } = useGraphHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
  );
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      pushHistory(); // MUST run before the mutation, capturing pre-delete state
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
    },
    [pushHistory, setNodes, setEdges],
  );

  useEffect(() => {
    function handleDeleteEvent(e: Event) {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) handleNodeDelete(nodeId);
    }
    window.addEventListener("atlas-delete-node", handleDeleteEvent);
    return () =>
      window.removeEventListener("atlas-delete-node", handleDeleteEvent);
  }, [handleNodeDelete]);

  const handleSave = useCallback(async () => {
    pushHistory();
    setSaving(true);
    try {
      const updated = await updateWorkflowGraph(workflow.id, {
        nodes: nodes as unknown as WorkflowGraph["nodes"],
        edges: edges as unknown as WorkflowGraph["edges"],
      });
      onSaved?.(updated);
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, workflow.id, onSaved, pushHistory]);

  const handleRun = useCallback(async () => {
    const validation = validateGraph(nodes, edges);
    if (!validation.valid) {
      alert("Cannot run this workflow:\n\n" + validation.errors.join("\n"));
      return;
    }
    await handleSave();
    try {
      await runWorkflow(workflow.id);
      setShowRuns(true);
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.error : undefined;
      alert(message || "Failed to start this workflow run.");
    }
    setShowRuns(true);
    setShowVersions(false);
    setSelectedNodeId(null);
  }, [nodes, edges, handleSave, workflow.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "Z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleRun, undo, redo]);

  async function handleSuggestNext() {
    setSuggestLoading(true);
    try {
      const res = await api.post(`/workflows/${workflow.id}/suggest-next`, {});
      setSuggestions(res.data);
    } finally {
      setSuggestLoading(false);
    }
  }

  function addSuggestedNode(suggestion: { kind: string; label: string }) {
    idCounter.current += 1;
    const newNode: Node = {
      id: `node-${Date.now()}-${idCounter.current}`,
      type: "custom",
      position: { x: 100 + nodes.length * 250, y: 300 },
      data: { label: suggestion.label, kind: suggestion.kind, config: {} },
    };
    pushHistory();
    setNodes((nds) => nds.concat(newNode));
    setSuggestions([]);
  }

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
              branch: connection.sourceHandle === "false" ? "false" : "true",
            }
          : undefined,
      };

      pushHistory();
      setEdges((eds) => addEdge(edge, eds));
    },
    [nodes, setEdges, pushHistory],
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/atlas-node");
    if (!raw) return;
    pushHistory();
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
    setSelectedNodeId(node.id);
    setShowRuns(false);
    setShowVersions(false);
  }

  function handleNodeConfigSave(
    nodeId: string,
    config: Record<string, unknown>,
  ) {
    pushHistory();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, config } } : n,
      ),
    );
  }

  function toggleRuns() {
    setShowRuns(!showRuns);
    setShowVersions(false);
    setSelectedNodeId(null);
  }

  function toggleVersions() {
    setShowVersions(!showVersions);
    setShowRuns(false);
    setSelectedNodeId(null);
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <NodePalette />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{workflow.name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              Webhook: {import.meta.env.VITE_API_URL}/webhooks/
              {workflow.webhookToken}
            </span>
            <Button
              variant="secondary"
              onClick={handleSuggestNext}
              disabled={suggestLoading}
            >
              {suggestLoading ? "Thinking…" : "💡 Suggest next"}
            </Button>
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
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface/50 flex-wrap">
            <span className="text-xs text-muted">Suggested next:</span>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => addSuggestedNode(s)}
                title={s.reason}
                className="text-xs bg-bg border border-border rounded-pill px-3 py-1 hover:border-accent transition-colors"
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => setSuggestions([])}
              className="text-xs text-muted hover:text-danger ml-auto"
            >
              ✕
            </button>
          </div>
        )}
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
          onClose={() => setSelectedNodeId(null)}
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
