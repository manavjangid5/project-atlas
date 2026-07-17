import { evaluateConditions } from "./ruleEvaluator";

describe("evaluateConditions", () => {
  it("evaluates a simple equals condition", () => {
    const node = { type: "condition" as const, field: "location", operator: "equals" as const, value: "India" };
    expect(evaluateConditions(node, { location: "India" })).toBe(true);
    expect(evaluateConditions(node, { location: "USA" })).toBe(false);
  });

  it("evaluates greaterThan numerically, not as strings", () => {
    const node = { type: "condition" as const, field: "experience", operator: "greaterThan" as const, value: 5 };
    expect(evaluateConditions(node, { experience: 7 })).toBe(true);
    expect(evaluateConditions(node, { experience: "7" })).toBe(true); // string coercion
    expect(evaluateConditions(node, { experience: 3 })).toBe(false);
  });

  it("AND group requires all children to match", () => {
    const node = {
      type: "group" as const,
      logic: "AND" as const,
      children: [
        { type: "condition" as const, field: "location", operator: "equals" as const, value: "India" },
        { type: "condition" as const, field: "experience", operator: "greaterThan" as const, value: 5 },
      ],
    };
    expect(evaluateConditions(node, { location: "India", experience: 7 })).toBe(true);
    expect(evaluateConditions(node, { location: "India", experience: 2 })).toBe(false);
  });

  it("OR group requires only one child to match", () => {
    const node = {
      type: "group" as const,
      logic: "OR" as const,
      children: [
        { type: "condition" as const, field: "location", operator: "equals" as const, value: "India" },
        { type: "condition" as const, field: "location", operator: "equals" as const, value: "UK" },
      ],
    };
    expect(evaluateConditions(node, { location: "UK" })).toBe(true);
    expect(evaluateConditions(node, { location: "USA" })).toBe(false);
  });

  it("handles nested groups correctly", () => {
    const node = {
      type: "group" as const,
      logic: "AND" as const,
      children: [
        { type: "condition" as const, field: "location", operator: "equals" as const, value: "India" },
        {
          type: "group" as const,
          logic: "OR" as const,
          children: [
            { type: "condition" as const, field: "role", operator: "equals" as const, value: "admin" },
            { type: "condition" as const, field: "role", operator: "equals" as const, value: "owner" },
          ],
        },
      ],
    };
    expect(evaluateConditions(node, { location: "India", role: "admin" })).toBe(true);
    expect(evaluateConditions(node, { location: "India", role: "viewer" })).toBe(false);
  });
});