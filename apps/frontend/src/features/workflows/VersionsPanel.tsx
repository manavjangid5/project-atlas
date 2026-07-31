import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";

interface Version { id: string; version: number; createdAt: string; graph: any; }

export default function VersionsPanel({ workflowId, onRestored }: { workflowId: string; onRestored: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");

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
    } catch (err: any) {
      setError(err?.response?.data?.error || "Restore failed.");
    }
  }

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">Version History</h3>
        {error && <p className="text-danger text-xs mt-1">{error}</p>}
      </div>

      <div className="flex-1">
        {versions.length === 0 ? (
          <p className="text-xs text-muted p-4">No versions saved yet.</p>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
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
    </div>
  );
}