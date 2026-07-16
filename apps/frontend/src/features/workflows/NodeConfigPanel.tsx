import { useState, useEffect } from "react";
import type { Node } from "reactflow";
import { NODE_CONFIG_SCHEMAS } from "./nodeConfigSchemas";
import { Button } from "../../components/Button";

interface Props {
  node: Node | null;
  onClose: () => void;
  onSave: (nodeId: string, config: Record<string, any>) => void;
  onDelete: (nodeId: string) => void;
}

export default function NodeConfigPanel({ node, onClose, onSave, onDelete }: Props) {
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) setConfig(node.data?.config || {});
  }, [node]);

  if (!node) return null;

  const kind = node.data.kind as keyof typeof NODE_CONFIG_SCHEMAS;
  const fields = NODE_CONFIG_SCHEMAS[kind] || [];

  // Every keystroke immediately pushes into the canvas node's data —
  // no separate "Apply" step to forget. The top-level Save button
  // (canvas toolbar) then always persists whatever is currently on
  // screen, matching user expectation of "what I see is what saves."
  function handleChange(key: string, value: string) {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    onSave(node!.id, updated);
  }

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">{node.data.label}</h3>
          <p className="text-xs text-muted capitalize">{kind.replace("_", " ")}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-text text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {fields.length === 0 && (
          <p className="text-xs text-muted">No configurable fields for this node type yet.</p>
        )}
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-muted block mb-1">{field.label}</label>
            {field.type === "select" ? (
              <select
                value={config[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full bg-bg border border-border rounded-sm px-2 py-1.5 text-sm"
              >
                <option value="">Select…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={config[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={4}
                className="w-full bg-bg border border-border rounded-sm px-2 py-1.5 text-sm resize-none"
              />
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                value={config[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-bg border border-border rounded-sm px-2 py-1.5 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">Done</Button>
        <Button variant="secondary" onClick={() => { onDelete(node!.id); onClose(); }}>
          Delete
        </Button>
      </div>
    </div>
  );
}