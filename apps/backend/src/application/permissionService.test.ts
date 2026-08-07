jest.mock("@atlas/database", () => ({
  prisma: { permission: { findUnique: jest.fn() } },
}));

import { can } from "./permissionService";
import { prisma } from "@atlas/database";

describe("permissionService.can", () => {
  beforeEach(() => jest.clearAllMocks());

  it("falls back to the default matrix when no override row exists", async () => {
    (prisma.permission.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await can("org1", "DEVELOPER", "workflow", "create");
    expect(result).toBe(true); // DEVELOPER can create workflows per default matrix
  });

  it("respects a VIEWER's lack of default create access", async () => {
    (prisma.permission.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await can("org1", "VIEWER", "workflow", "create");
    expect(result).toBe(false);
  });

  it("an explicit org override takes precedence over the default matrix", async () => {
    (prisma.permission.findUnique as jest.Mock).mockResolvedValue({ allowed: true });
    const result = await can("org1", "VIEWER", "workflow", "create"); // normally false by default
    expect(result).toBe(true); // but this org explicitly granted it
  });

  it("an explicit denial override can also restrict a normally-allowed role", async () => {
    (prisma.permission.findUnique as jest.Mock).mockResolvedValue({ allowed: false });
    const result = await can("org1", "OWNER", "workflow", "create");
    expect(result).toBe(false);
  });
});