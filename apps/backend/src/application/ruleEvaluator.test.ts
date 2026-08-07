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

describe("evaluateConditions — edge cases found during manual testing", () => {
  it("an empty AND group never matches (vacuous truth guard)", () => {
    const node = { type: "group" as const, logic: "AND" as const, children: [] };
    expect(evaluateConditions(node, { anything: "here" })).toBe(false);
    expect(evaluateConditions(node, {})).toBe(false);
  });

  it("an empty OR group never matches", () => {
    const node = { type: "group" as const, logic: "OR" as const, children: [] };
    expect(evaluateConditions(node, { anything: "here" })).toBe(false);
  });

  it("resolves nested dot-path fields, not just top-level keys", () => {
    const node = {
      type: "condition" as const,
      field: "candidate.experience",
      operator: "greaterThan" as const,
      value: 2,
    };
    expect(evaluateConditions(node, { candidate: { experience: 3 } })).toBe(true);
    expect(evaluateConditions(node, { candidate: { experience: 1 } })).toBe(false);
  });

  it("dot-path resolution returns false (not a crash) when an intermediate key is missing", () => {
    const node = {
      type: "condition" as const,
      field: "candidate.location",
      operator: "equals" as const,
      value: "India",
    };
    expect(evaluateConditions(node, {})).toBe(false);
    expect(evaluateConditions(node, { candidate: null })).toBe(false);
  });

  it("a real nested AND/OR tree against realistic recruiter data matches correctly", () => {
    const node = {
      type: "group" as const,
      logic: "AND" as const,
      children: [
        { type: "condition" as const, field: "candidate.location", operator: "equals" as const, value: "India" },
        { type: "condition" as const, field: "candidate.experience", operator: "greaterThan" as const, value: 2 },
        {
          type: "group" as const,
          logic: "OR" as const,
          children: [
            { type: "condition" as const, field: "candidate.skills", operator: "contains" as const, value: "Node.js" },
            { type: "condition" as const, field: "job.role", operator: "equals" as const, value: "Full Stack Developer" },
          ],
        },
        { type: "condition" as const, field: "application.status", operator: "notEquals" as const, value: "Rejected" },
      ],
    };
    const shouldMatch = {
      candidate: { location: "India", experience: 3, skills: ["React", "Node.js"] },
      job: { role: "Full Stack Developer" },
      application: { status: "Applied" },
    };
    const shouldNotMatch = {
      candidate: { location: "India", experience: 1, skills: ["Python"] },
      job: { role: "Backend Developer" },
      application: { status: "Rejected" },
    };
    expect(evaluateConditions(node, shouldMatch)).toBe(true);
    expect(evaluateConditions(node, shouldNotMatch)).toBe(false);
  });
});