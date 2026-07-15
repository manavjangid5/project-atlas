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

export default function CustomNode({ data }: { data: WorkflowNodeData }) {
  return (
    <div className="bg-surface border border-border rounded-md px-4 py-3 min-w-[160px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-accent !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <span>{KIND_ICONS[data.kind] || "⚙"}</span>
        <span className="text-sm font-semibold">{data.label}</span>
      </div>
      <p className="text-xs text-muted mt-1 capitalize">{data.kind.replace("_", " ")}</p>
      <Handle type="source" position={Position.Right} className="!bg-accent !w-2 !h-2" />
    </div>
  );
}