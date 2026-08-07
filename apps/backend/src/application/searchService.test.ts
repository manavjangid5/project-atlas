jest.mock("@atlas/database", () => ({
  prisma: {
    workflow: { findMany: jest.fn().mockResolvedValue([]) },
    formSchema: { findMany: jest.fn().mockResolvedValue([]) },
    rule: { findMany: jest.fn().mockResolvedValue([]) },
    fileAsset: { findMany: jest.fn().mockResolvedValue([]) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    apiKey: { findMany: jest.fn().mockResolvedValue([]) },
    organization: { findMany: jest.fn() },
    executionLog: { findMany: jest.fn() },
  },
}));

import { globalSearch } from "./searchService";
import { prisma } from "@atlas/database";

describe("globalSearch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("includes a matching organization in results with the correct type", async () => {
    (prisma.organization.findMany as jest.Mock).mockResolvedValue([{ id: "org1", name: "Acme Inc" }]);
    (prisma.executionLog.findMany as jest.Mock).mockResolvedValue([]);

    const results = await globalSearch("org1", "Acme");
    expect(results.some((r) => r.type === "organization" && r.title === "Acme Inc")).toBe(true);
  });

  it("includes a matching execution log with its workflow name as context", async () => {
    (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.executionLog.findMany as jest.Mock).mockResolvedValue([
      { id: "log1", message: "connection timeout", nodeId: "node-1", run: { workflow: { name: "Nightly Sync" } } },
    ]);

    const results = await globalSearch("org1", "timeout");
    const logResult = results.find((r) => r.type === "log");
    expect(logResult).toBeDefined();
    expect(logResult?.subtitle).toContain("Nightly Sync");
  });

  it("returns an empty array for a query under 2 characters, without hitting the database", async () => {
    const results = await globalSearch("org1", "a");
    expect(results).toEqual([]);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });
});