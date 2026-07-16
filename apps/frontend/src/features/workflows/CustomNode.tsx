import { Handle, Position } from "reactflow";
import type { WorkflowNodeData } from "./workflowTypes";

const KIND_ICONS: Record<string, string> = {
  http_request: "🌐",
  delay: "⏱",
  conditional: "🔀",
  slack: "💬",
  ai_prompt: "✨",
  webhook: "🔗",
};

interface Props {
  id: string;
  data: WorkflowNodeData;
}

export default function CustomNode({ id, data }: Props) {
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); // prevent this click from also opening the config panel
    window.dispatchEvent(new CustomEvent("atlas-delete-node", { detail: { nodeId: id } }));
  }

  return (
    <div className="group relative bg-surface border border-border rounded-md px-4 py-3 min-w-[160px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-accent !w-2 !h-2" />

      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        title="Delete node"
      >
        ✕
      </button>

      <div className="flex items-center gap-2">
        <span>{KIND_ICONS[data.kind] || "⚙"}</span>
        <span className="text-sm font-semibold">{data.label}</span>
      </div>
      <p className="text-xs text-muted mt-1 capitalize">{data.kind.replace("_", " ")}</p>
      <Handle type="source" position={Position.Right} className="!bg-accent !w-2 !h-2" />
    </div>
  );
}