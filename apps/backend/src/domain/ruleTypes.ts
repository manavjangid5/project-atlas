export type Operator = "equals" | "notEquals" | "greaterThan" | "lessThan" | "contains";

export interface ConditionLeaf {
  type: "condition";
  field: string;
  operator: Operator;
  value: any;
}

export interface ConditionGroup {
  type: "group";
  logic: "AND" | "OR";
  children: ConditionNode[];
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

export interface RuleAction {
  kind: "TRIGGER_WORKFLOW" | "NOTIFY" | "NONE";
  workflowId?: string;
  message?: string;
}