import { useEffect, useState } from "react";
import { listFlags, createFlag, updateFlag } from "./featureFlagsApi";
import type { FeatureFlag } from "./featureFlagsApi";
import { Button } from "../../components/Button";

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");

  function refresh() {
    listFlags().then(setFlags);
  }

  useEffect(refresh, []);

  async function handleCreate() {
    if (!newKey.trim()) return;
    await createFlag(newKey.trim(), newDesc.trim());
    setNewKey("");
    setNewDesc("");
    refresh();
  }

  async function toggleGlobal(flag: FeatureFlag) {
    await updateFlag(flag.id, { isGloballyEnabled: !flag.isGloballyEnabled });
    refresh();
  }

  async function updateRollout(flag: FeatureFlag, percentage: number) {
    await updateFlag(flag.id, { rolloutPercentage: percentage });
    refresh();
  }

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-xl font-bold mb-1">Feature Flags</h2>
      <p className="text-muted text-sm mb-6">Control feature rollout globally or by percentage.</p>

      <div className="flex gap-2 mb-6">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="flag_key"
          className="w-40 bg-surface border border-border rounded-sm px-3 py-2 text-sm font-mono"
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Description"
          className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-sm"
        />
        <Button onClick={handleCreate}>Create</Button>
      </div>

      <div className="space-y-3">
        {flags.map((flag) => (
          <div key={flag.id} className="bg-surface border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <code className="text-sm font-semibold">{flag.key}</code>
                <p className="text-xs text-muted">{flag.description}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={flag.isGloballyEnabled}
                  onChange={() => toggleGlobal(flag)}
                />
                Globally enabled
              </label>
            </div>
            {!flag.isGloballyEnabled && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={flag.rolloutPercentage}
                  onChange={(e) => updateRollout(flag, parseInt(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-muted w-12 text-right">{flag.rolloutPercentage}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}