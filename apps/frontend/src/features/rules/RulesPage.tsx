import { useEffect, useState } from "react";
import { listRules, createRule, updateRule } from "./rulesApi";
import type { RuleModel } from "./ruleTypes";
import { newGroup } from "./ruleTypes";
import ConditionNodeEditor from "./ConditionNodeEditor";
import RuleActionEditor from "./RuleActionEditor";
import RuleTestPanel from "./RuleTestPanel";
import { Button } from "../../components/Button";

export default function RulesPage() {
  const [rules, setRules] = useState<RuleModel[]>([]);
  const [active, setActive] = useState<RuleModel | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listRules().then(setRules);
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    const rule = await createRule(newName);
    setRules((prev) => [...prev, rule]);
    setActive({ ...rule, conditions: rule.conditions?.children ? rule.conditions : newGroup() });
    setNewName("");
  }

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await updateRule(active.id, { conditions: active.conditions, action: active.action });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } finally {
      setSaving(false);
    }
  }

  if (active) {
    return (
      <div className="p-8 max-w-3xl">
        <button onClick={() => setActive(null)} className="text-xs text-muted hover:text-text mb-4">
          ← Back to rules
        </button>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{active.name}</h2>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>

        <h3 className="text-sm font-semibold text-muted mb-2">Conditions</h3>
        <div className="mb-6">
          <ConditionNodeEditor
            node={active.conditions}
            onChange={(updated) => setActive({ ...active, conditions: updated as any })}
            onDelete={() => {}}
            depth={0}
          />
        </div>

        <h3 className="text-sm font-semibold text-muted mb-2">Action</h3>
        <div className="mb-6">
          <RuleActionEditor action={active.action} onChange={(a) => setActive({ ...active, action: a })} />
        </div>

        <h3 className="text-sm font-semibold text-muted mb-2">Test</h3>
        <RuleTestPanel ruleId={active.id} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Rules</h2>
      <div className="flex gap-2 mb-6 max-w-md">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New rule name"
          className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-sm"
        />
        <Button onClick={handleCreate}>Create</Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-muted text-sm">No rules yet — create one above.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {rules.map((rule) => (
            <button
              key={rule.id}
              onClick={() => setActive(rule)}
              className="text-left bg-surface border border-border rounded-md p-4 hover:border-accent transition-colors"
            >
              <h3 className="font-semibold text-sm">{rule.name}</h3>
              <p className="text-xs text-muted mt-1">{rule.isActive ? "Active" : "Inactive"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}