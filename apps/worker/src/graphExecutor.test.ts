// Mocks Prisma and axios so this tests the actual graph-walking logic
// in isolation, not real DB/network calls.
jest.mock("./db", () => ({
  prisma: {
    executionRun: { update: jest.fn() },
    executionLog: { create: jest.fn() },
  },
}));
jest.mock("./nodeExecutors", () => ({
  executeNode: jest.fn(),
}));
jest.mock("axios", () => ({
  post: jest.fn().mockResolvedValue({ data: { ok: true } }),
}));

import { executeGraph } from "./graphExecutor";
import { executeNode } from "./nodeExecutors";

describe("executeGraph", () => {
  beforeEach(() => jest.clearAllMocks());

  it("runs independent nodes and marks the run SUCCESS when all pass", async () => {
    (executeNode as jest.Mock).mockResolvedValue({ status: "SUCCESS", output: { ok: true } });

    const graph = {
      nodes: [
        { id: "a", data: { kind: "http_request", config: {} } },
        { id: "b", data: { kind: "http_request", config: {} } },
      ],
      edges: [],
    };

    const status = await executeGraph("run1", graph);
    expect(status).toBe("SUCCESS");
    expect(executeNode).toHaveBeenCalledTimes(2);
  });

  it("skips downstream nodes when an upstream node fails", async () => {
    (executeNode as jest.Mock)
      .mockResolvedValueOnce({ status: "FAILED", error: "boom" })
      .mockResolvedValueOnce({ status: "FAILED", error: "boom" })
      .mockResolvedValueOnce({ status: "FAILED", error: "boom" }); // 3 attempts due to retry logic

    const graph = {
      nodes: [
        { id: "a", data: { kind: "http_request", config: {} } },
        { id: "b", data: { kind: "http_request", config: {} } },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };

    const status = await executeGraph("run2", graph);
    expect(status).toBe("FAILED");
    // node b should never have been attempted since its dependency failed
    expect(executeNode).toHaveBeenCalledTimes(3); // only node a's 3 retry attempts
  });
});
describe("executeGraph — conditional branching status semantics", () => {
  it("a correctly-taken branch reports SUCCESS, not PARTIAL — skipping the untaken branch is not a failure", async () => {
    (executeNode as jest.Mock)
      .mockResolvedValueOnce({ status: "SUCCESS", output: { branch: "false" } }) // conditional node
      .mockResolvedValueOnce({ status: "SUCCESS", output: { text: "false branch ran" } }); // false-branch node

    const graph = {
      nodes: [
        { id: "cond", data: { kind: "conditional", config: {} } },
        { id: "trueNode", data: { kind: "ai_prompt", config: {} } },
        { id: "falseNode", data: { kind: "ai_prompt", config: {} } },
      ],
      edges: [
        { id: "e1", source: "cond", target: "trueNode", data: { branch: "true" as const } },
        { id: "e2", source: "cond", target: "falseNode", data: { branch: "false" as const } },
      ],
    };

    const status = await executeGraph("run-branch-test", graph);
    expect(status).toBe("SUCCESS");
  });

  it("a genuine upstream node failure still reports FAILED/PARTIAL, distinct from a branch skip", async () => {
    (executeNode as jest.Mock).mockResolvedValue({ status: "FAILED", error: "boom" });

    const graph = {
      nodes: [
        { id: "a", data: { kind: "http_request", config: {} } },
        { id: "b", data: { kind: "http_request", config: {} } },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }], // plain edge, not a branch edge
    };

    const status = await executeGraph("run-fail-test", graph);
    expect(status).toBe("FAILED");
  });
});