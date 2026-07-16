import type { RuleAction } from "./ruleTypes";

interface Props {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
}

export default function RuleActionEditor({ action, onChange }: Props) {
  return (
    <div className="bg-surface border border-border rounded-md p-4 space-y-3">
      <label className="text-xs text-muted block">When conditions match:</label>
      <select
        value={action.kind}
        onChange={(e) => onChange({ ...action, kind: e.target.value as RuleAction["kind"] })}
        className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
      >
        <option value="NONE">Do nothing (test only)</option>
        <option value="NOTIFY">Send notification</option>
        <option value="TRIGGER_WORKFLOW">Trigger a workflow</option>
      </select>

      {action.kind === "NOTIFY" && (
        <input
          value={action.message || ""}
          onChange={(e) => onChange({ ...action, message: e.target.value })}
          placeholder="Notification message"
          className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
        />
      )}
      {action.kind === "TRIGGER_WORKFLOW" && (
        <input
          value={action.workflowId || ""}
          onChange={(e) => onChange({ ...action, workflowId: e.target.value })}
          placeholder="Workflow ID"
          className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}