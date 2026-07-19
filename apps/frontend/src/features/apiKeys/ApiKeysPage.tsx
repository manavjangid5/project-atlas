import { useEffect, useState } from "react";
import { listApiKeys, createApiKey, revokeApiKey, getUsageStats } from "./apiKeysApi";
import type { ApiKey } from "./apiKeysApi";
import { Button } from "../../components/Button";
import { useAuthStore } from "../../store/authStore";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<{ totalRequests: number; requestsLast24h: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  function refresh() {
    listApiKeys().then(setKeys);
    getUsageStats().then(setUsage);
  }

  const activeOrgId = useAuthStore((s) => s.activeOrgId);
useEffect(refresh, [activeOrgId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const { rawKey } = await createApiKey(newName);
    setRevealedKey(rawKey);
    setNewName("");
    refresh();
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await revokeApiKey(id);
    refresh();
  }

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-xl font-bold mb-1">API Keys</h2>
      <p className="text-muted text-sm mb-6">Manage programmatic access to your organization's data.</p>

      {usage && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-md p-4">
            <p className="text-xs text-muted mb-1">Total Requests</p>
            <p className="text-2xl font-bold">{usage.totalRequests}</p>
          </div>
          <div className="bg-surface border border-border rounded-md p-4">
            <p className="text-xs text-muted mb-1">Last 24 Hours</p>
            <p className="text-2xl font-bold text-accent">{usage.requestsLast24h}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Key name (e.g. 'CI Pipeline')"
          className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-sm"
        />
        <Button onClick={handleCreate}>Generate Key</Button>
      </div>

      {revealedKey && (
        <div className="bg-accent/10 border border-accent/30 rounded-md p-4 mb-6">
          <p className="text-xs text-muted mb-2">Copy this key now — it won't be shown again.</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-bg border border-border rounded-sm px-3 py-2 text-xs break-all">{revealedKey}</code>
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(revealedKey)}>Copy</Button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-xs text-muted hover:text-text mt-2">Dismiss</button>
        </div>
      )}

      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key.id} className="flex items-center gap-3 bg-surface border border-border rounded-md px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{key.name}</p>
              <p className="text-xs text-muted font-mono">{key.keyPrefix}••••••••</p>
            </div>
            <p className="text-xs text-muted">
              {key.revokedAt ? "Revoked" : key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}
            </p>
            {!key.revokedAt && (
              <button onClick={() => handleRevoke(key.id)} className="text-xs text-muted hover:text-danger">
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}