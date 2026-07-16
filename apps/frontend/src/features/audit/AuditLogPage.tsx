import { useEffect, useState } from "react";
import { fetchAuditLogs } from "./auditApi";
import type { AuditLogEntry } from "./auditApi";
import { Button } from "../../components/Button";

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "Signed in",
  WORKFLOW_UPDATED: "Updated workflow",
  WORKFLOW_EXECUTED: "Ran workflow",
  ROLE_UPDATED: "Changed member role",
};

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: "bg-blue-500/10 text-blue-400",
  WORKFLOW_UPDATED: "bg-yellow-500/10 text-yellow-400",
  WORKFLOW_EXECUTED: "bg-green-500/10 text-green-400",
  ROLE_UPDATED: "bg-accent/10 text-accent",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAuditLogs(page)
      .then((res) => {
        setLogs(res.logs);
        setPages(res.pages);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-xl font-bold mb-1">Audit Log</h2>
      <p className="text-muted text-sm mb-6">
        A record of important actions in this organization — logins, workflow changes, and permission updates.
      </p>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-muted text-sm">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 bg-surface border border-border rounded-md px-4 py-3"
            >
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-pill whitespace-nowrap ${
                  ACTION_COLORS[log.action] || "bg-muted/10 text-muted"
                }`}
              >
                {ACTION_LABELS[log.action] || log.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  {log.user?.email || "System"}
                  {log.metadata && (
                    <span className="text-muted"> — {JSON.stringify(log.metadata).slice(0, 100)}</span>
                  )}
                </p>
              </div>
              <span className="text-xs text-muted whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted self-center">Page {page} of {pages}</span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}