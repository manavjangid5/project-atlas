import { useState } from "react";
import { api } from "../../lib/api";
import { AxiosError } from "axios";
import { Button } from "../../components/Button";
import type { Workflow } from "./workflowTypes";

interface Props {
  onClose: () => void;
  onGenerated: (workflow: Workflow) => void;
}

export default function GenerateWorkflowModal({ onClose, onGenerated }: Props) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!instruction.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/workflows/generate", { instruction });
      onGenerated(res.data);
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.error : undefined;
      setError(message || "Generation failed — try rephrasing your instruction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border rounded-md p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-1">Generate a workflow with AI</h3>
        <p className="text-xs text-muted mb-4">
          Describe what you want automated — e.g. "Every time a form is submitted, summarize it with AI and send it to Slack."
        </p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={4}
          placeholder="Describe your automation..."
          className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm resize-none mb-3"
        />
        {error && <p className="text-danger text-xs mb-3">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={loading} className="flex-1">
            {loading ? "Generating…" : "Generate"}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}