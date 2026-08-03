import type { WorkflowGraph } from "./workflowTypes";

interface Props {
  versionA: { version: number; graph: WorkflowGraph };
  versionB: { version: number; graph: WorkflowGraph };
  onClose: () => void;
}

export default function VersionDiff({ versionA, versionB, onClose }: Props) {
  const aIds = new Set(versionA.graph.nodes.map((n) => n.id));
  const bIds = new Set(versionB.graph.nodes.map((n) => n.id));

  const added = versionB.graph.nodes.filter((n) => !aIds.has(n.id));
  const removed = versionA.graph.nodes.filter((n) => !bIds.has(n.id));
  const common = versionB.graph.nodes.filter((n) => aIds.has(n.id));
  const modified = common.filter((n) => {
    const old = versionA.graph.nodes.find((o) => o.id === n.id);
    return JSON.stringify(old?.data) !== JSON.stringify(n.data);
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border rounded-md p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4">
          Comparing v{versionA.version} → v{versionB.version}
        </h3>

        {added.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-accent mb-1">Added ({added.length})</p>
            {added.map((n) => <p key={n.id} className="text-xs text-muted">+ {n.data.label} ({n.data.kind})</p>)}
          </div>
        )}
        {removed.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-danger mb-1">Removed ({removed.length})</p>
            {removed.map((n) => <p key={n.id} className="text-xs text-muted">− {n.data.label} ({n.data.kind})</p>)}
          </div>
        )}
        {modified.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-yellow-400 mb-1">Modified ({modified.length})</p>
            {modified.map((n) => <p key={n.id} className="text-xs text-muted">~ {n.data.label}</p>)}
          </div>
        )}
        {added.length === 0 && removed.length === 0 && modified.length === 0 && (
          <p className="text-xs text-muted">No differences between these versions.</p>
        )}

        <button onClick={onClose} className="text-xs text-muted hover:text-text mt-4">Close</button>
      </div>
    </div>
  );
}