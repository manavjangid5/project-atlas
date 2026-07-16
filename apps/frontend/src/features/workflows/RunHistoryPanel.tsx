import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface RunLog {
  nodeId: string;
  status: string;
  message?: string;
  createdAt: string;
}
interface Run {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  logs: RunLog[];
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "text-green-400",
  FAILED: "text-danger",
  PARTIAL: "text-yellow-400",
  RUNNING: "text-accent",
  PENDING: "text-muted",
};

export default function RunHistoryPanel({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  async function refresh() {
    const res = await api.get(`/workflows/${workflowId}/runs`);
    setRuns(res.data);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000); // poll every 3s for live updates
    return () => clearInterval(interval);
  }, [workflowId]);

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Run History</h3>
      </div>
      <div className="flex-1 overflow-auto">
        {runs.length === 0 && (
          <p className="text-xs text-muted p-4">No runs yet — hit Run to execute this workflow.</p>
        )}
        {runs.map((run) => (
          <div key={run.id} className="border-b border-border">
            <button
              onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              className="w-full text-left px-4 py-3 hover:bg-surfaceHover"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${STATUS_COLORS[run.status] || "text-muted"}`}>
                  {run.status}
                </span>
                <span className="text-xs text-muted">
                  {new Date(run.startedAt).toLocaleTimeString()}
                </span>
              </div>
            </button>
            {expandedRun === run.id && (
              <div className="px-4 pb-3 space-y-2">
                {run.logs.map((log, i) => (
                  <div key={i} className="text-xs bg-bg border border-border rounded-sm p-2">
                    <div className="flex justify-between">
                      <span className="text-muted">{log.nodeId}</span>
                      <span className={STATUS_COLORS[log.status] || "text-muted"}>{log.status}</span>
                    </div>
                    {log.message && (
                      <p className="text-muted mt-1 break-words">{log.message.slice(0, 200)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}