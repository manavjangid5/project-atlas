import type { ConditionNode, ConditionLeaf, ConditionGroup, Operator } from "./ruleTypes";
import { newLeaf, newGroup } from "./ruleTypes";

const OPERATORS: Operator[] = ["equals", "notEquals", "greaterThan", "lessThan", "contains"];

interface Props {
  node: ConditionNode;
  onChange: (updated: ConditionNode) => void;
  onDelete: () => void;
  depth: number;
}

export default function ConditionNodeEditor({ node, onChange, onDelete, depth }: Props) {
  if (node.type === "condition") {
    return <LeafEditor leaf={node} onChange={onChange as (l: ConditionLeaf) => void} onDelete={onDelete} />;
  }
  return <GroupEditor group={node} onChange={onChange as (g: ConditionGroup) => void} onDelete={onDelete} depth={depth} />;
}

function LeafEditor({
  leaf,
  onChange,
  onDelete,
}: {
  leaf: ConditionLeaf;
  onChange: (l: ConditionLeaf) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-bg border border-border rounded-sm px-3 py-2">
      <input
        value={leaf.field}
        onChange={(e) => onChange({ ...leaf, field: e.target.value })}
        placeholder="field"
        className="w-32 bg-transparent text-sm focus:outline-none placeholder:text-muted"
      />
      <select
        value={leaf.operator}
        onChange={(e) => onChange({ ...leaf, operator: e.target.value as Operator })}
        className="bg-surface border border-border rounded-sm text-xs px-1.5 py-1"
      >
        {OPERATORS.map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      <input
        value={leaf.value}
        onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        placeholder="value"
        className="w-28 bg-transparent text-sm focus:outline-none placeholder:text-muted"
      />
      <button onClick={onDelete} className="text-muted hover:text-danger text-xs ml-auto">✕</button>
    </div>
  );
}

function GroupEditor({
  group,
  onChange,
  onDelete,
  depth,
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  onDelete: () => void;
  depth: number;
}) {
  function updateChild(index: number, updated: ConditionNode) {
    const children = [...group.children];
    children[index] = updated;
    onChange({ ...group, children });
  }

  function deleteChild(index: number) {
    onChange({ ...group, children: group.children.filter((_, i) => i !== index) });
  }

  return (
    <div
      className="border border-border rounded-md p-3 space-y-2"
      style={{ backgroundColor: depth % 2 === 0 ? "#161616" : "#1B1B1B" }}
    >
      <div className="flex items-center gap-2">
        <div className="flex bg-bg border border-border rounded-pill overflow-hidden text-xs">
          <button
            onClick={() => onChange({ ...group, logic: "AND" })}
            className={`px-3 py-1 ${group.logic === "AND" ? "bg-accent text-white" : "text-muted"}`}
          >
            AND
          </button>
          <button
            onClick={() => onChange({ ...group, logic: "OR" })}
            className={`px-3 py-1 ${group.logic === "OR" ? "bg-accent text-white" : "text-muted"}`}
          >
            OR
          </button>
        </div>
        <span className="text-xs text-muted">— all children must {group.logic === "AND" ? "match" : "any can match"}</span>
        {depth > 0 && (
          <button onClick={onDelete} className="text-muted hover:text-danger text-xs ml-auto">
            Remove group ✕
          </button>
        )}
      </div>

      <div className="pl-3 border-l border-border space-y-2">
        {group.children.map((child, i) => (
          <ConditionNodeEditor
            key={child.id}
            node={child}
            onChange={(updated) => updateChild(i, updated)}
            onDelete={() => deleteChild(i)}
            depth={depth + 1}
          />
        ))}
      </div>

      <div className="flex gap-2 pl-3">
        <button
          onClick={() => onChange({ ...group, children: [...group.children, newLeaf()] })}
          className="text-xs text-accent hover:underline"
        >
          + Condition
        </button>
        <button
          onClick={() => onChange({ ...group, children: [...group.children, newGroup()] })}
          className="text-xs text-accent hover:underline"
        >
          + Nested group
        </button>
      </div>
    </div>
  );
}