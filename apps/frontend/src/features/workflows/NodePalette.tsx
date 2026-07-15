import type { NodeKind } from "./workflowTypes";

const PALETTE_ITEMS: { kind: NodeKind; label: string }[] = [
  { kind: "http_request", label: "HTTP Request" },
  { kind: "delay", label: "Delay" },
  { kind: "conditional", label: "Conditional" },
  { kind: "slack", label: "Slack" },
  { kind: "ai_prompt", label: "AI Prompt" },
  { kind: "webhook", label: "Webhook" },
];

export default function NodePalette() {
  function onDragStart(e: React.DragEvent, kind: NodeKind, label: string) {
    e.dataTransfer.setData("application/atlas-node", JSON.stringify({ kind, label }));
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="w-56 border-r border-border bg-surface p-4 space-y-2">
      <h3 className="text-xs uppercase text-muted mb-3 tracking-wide">Nodes</h3>
      {PALETTE_ITEMS.map((item) => (
        <div
          key={item.kind}
          draggable
          onDragStart={(e) => onDragStart(e, item.kind, item.label)}
          className="bg-bg border border-border rounded-sm px-3 py-2 text-sm cursor-grab hover:border-accent transition-colors"
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}