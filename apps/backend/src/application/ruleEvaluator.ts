import type { ConditionNode, Operator } from "../domain/ruleTypes";

function evalLeafCondition(field: string, operator: Operator, expected: any, data: Record<string, any>): boolean {
  const actual = data[field];
  switch (operator) {
    case "equals": return actual === expected;
    case "notEquals": return actual !== expected;
    case "greaterThan": return Number(actual) > Number(expected);
    case "lessThan": return Number(actual) < Number(expected);
    case "contains": return String(actual ?? "").includes(String(expected));
    default: return false;
  }
}

// Recursively evaluates a nested AND/OR condition tree against input
// data. This is the same evaluation primitive as the workflow
// conditional node, generalized to support arbitrary nesting rather
// than a single flat comparison — that's what "entirely data-driven,
// no hardcoded business logic" (spec 4.6) actually requires.
export function evaluateConditions(node: ConditionNode, data: Record<string, any>): boolean {
  if (node.type === "condition") {
    return evalLeafCondition(node.field, node.operator, node.value, data);
  }
  if (node.type === "group") {
    if (node.logic === "AND") return node.children.every((c) => evaluateConditions(c, data));
    return node.children.some((c) => evaluateConditions(c, data));
  }
  return false;
}