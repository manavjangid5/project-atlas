export type Operator = "equals" | "notEquals" | "greaterThan" | "lessThan" | "contains";

export interface ConditionLeaf {
  type: "condition";
  id: string;
  field: string;
  operator: Operator;
  value: string;
}

export interface ConditionGroup {
  type: "group";
  id: string;
  logic: "AND" | "OR";
  children: ConditionNode[];
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

export interface RuleAction {
  kind: "TRIGGER_WORKFLOW" | "NOTIFY" | "NONE";
  workflowId?: string;
  message?: string;
}

export interface RuleModel {
  id: string;
  name: string;
  conditions: ConditionGroup;
  action: RuleAction;
  isActive: boolean;
}

export function newLeaf(): ConditionLeaf {
  return { type: "condition", id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, field: "", operator: "equals", value: "" };
}

export function newGroup(): ConditionGroup {
  return { type: "group", id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, logic: "AND", children: [] };
}