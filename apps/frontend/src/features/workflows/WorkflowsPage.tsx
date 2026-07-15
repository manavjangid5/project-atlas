import { useEffect, useState } from "react";
import { listWorkflows, createWorkflow } from "./workflowsApi";
import type { Workflow } from "./workflowTypes";
import WorkflowCanvas from "./WorkflowCanvas";
import { Button } from "../../components/Button";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [active, setActive] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listWorkflows().then((wfs) => {
      setWorkflows(wfs);
      setLoading(false);
    });
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    const wf = await createWorkflow(newName);
    setWorkflows((prev) => [...prev, wf]);
    setActive(wf);
    setNewName("");
  }

  if (active) {
    return (
      <div className="h-screen flex flex-col">
        <button
          onClick={() => setActive(null)}
          className="text-xs text-muted hover:text-text px-4 py-2 text-left border-b border-border"
        >
          ← Back to workflows
        </button>
        <div className="flex-1">
          <WorkflowCanvas workflow={active} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Workflows</h2>

      <div className="flex gap-2 mb-6 max-w-md">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New workflow name"
          className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button onClick={handleCreate}>Create</Button>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : workflows.length === 0 ? (
        <p className="text-muted text-sm">No workflows yet — create one above.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {workflows.map((wf) => (
            <button
              key={wf.id}
              onClick={() => setActive(wf)}
              className="text-left bg-surface border border-border rounded-md p-4 hover:border-accent transition-colors"
            >
              <h3 className="font-semibold text-sm">{wf.name}</h3>
              <p className="text-xs text-muted mt-1">{wf.graph?.nodes?.length || 0} nodes</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}