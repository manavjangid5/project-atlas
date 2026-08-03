import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";
import type { WorkflowGraph } from "./workflowTypes";
import { AxiosError } from "axios";
import VersionDiff from "./VersionDiff";

interface Version { id: string; version: number; createdAt: string; graph: WorkflowGraph; }

export default function VersionsPanel({ workflowId, onRestored }: { workflowId: string; onRestored: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    api.get(`/workflows/${workflowId}/versions?page=${page}`).then((res) => {
      setVersions(res.data.versions);
      setPages(res.data.pages);
    });
  }, [workflowId, page]);

  async function handleRestore(versionId: string) {
    if (!confirm("Restore this version? A new version will be created from it.")) return;
    try {
      await api.post(`/workflows/${workflowId}/versions/${versionId}/restore`);
      onRestored();
    } catch (err) {
      const message = err instanceof AxiosError ? err.response?.data?.error : undefined;
      setError(message || "Restore failed.");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  }

  const versionA = versions.find((v) => v.id === selected[0]);
  const versionB = versions.find((v) => v.id === selected[1]);

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Version History</h3>
        {selected.length === 2 && (
          <button onClick={() => setShowDiff(true)} className="text-xs text-accent hover:underline">
            Compare
          </button>
        )}
      </div>
      {error && <p className="text-danger text-xs px-4 pt-2">{error}</p>}
      {selected.length > 0 && (
        <p className="text-xs text-muted px-4 pt-2">
          {selected.length}/2 selected for comparison
        </p>
      )}

      <div className="flex-1">
        {versions.length === 0 ? (
          <p className="text-xs text-muted p-4">No versions saved yet.</p>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="px-4 py-3 border-b border-border flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(v.id)}
                onChange={() => toggleSelect(v.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">v{v.version}</p>
                <p className="text-xs text-muted">{new Date(v.createdAt).toLocaleString()}</p>
                <p className="text-xs text-muted">{v.graph?.nodes?.length || 0} nodes</p>
              </div>
              <Button variant="secondary" onClick={() => handleRestore(v.id)} className="shrink-0">
                Restore
              </Button>
            </div>
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="text-xs text-muted">Page {page} of {pages}</span>
          <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {showDiff && versionA && versionB && (
        <VersionDiff
          versionA={versionA.version < versionB.version ? versionA : versionB}
          versionB={versionA.version < versionB.version ? versionB : versionA}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
}