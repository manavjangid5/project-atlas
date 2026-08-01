import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { signAccessToken } from "../../../infrastructure/auth/tokens";
import { requireAuth } from "./auth";
import { requireTenant, TenantRequest } from "./tenant";

const prisma = new PrismaClient();

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, requireTenant, (req: TenantRequest, res) => {
    res.json({ organizationId: req.tenant!.organizationId });
  });
  return app;
}

describe("Tenant isolation (integration)", () => {
  let userA: { id: string; email: string };
  let orgA: { id: string };
  let orgB: { id: string }; // userA is NOT a member of this one

  beforeAll(async () => {
    userA = await prisma.user.create({
      data: { email: `tenant-test-${Date.now()}@test.com`, passwordHash: "x" },
    });
    orgA = await prisma.organization.create({ data: { name: "Org A" } });
    orgB = await prisma.organization.create({ data: { name: "Org B" } });
    await prisma.membership.create({
      data: { userId: userA.id, organizationId: orgA.id, role: "OWNER" },
    });
    // Deliberately no membership created for userA in orgB
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { userId: userA.id } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.$disconnect();
  });

  it("allows access to an organization the user is a member of", async () => {
    const token = signAccessToken({ id: userA.id, email: userA.email });
    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", [`accessToken=${token}`])
      .set("X-Organization-Id", orgA.id);

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it("rejects access to an organization the user is NOT a member of — the core isolation guarantee", async () => {
    const token = signAccessToken({ id: userA.id, email: userA.email });
    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", [`accessToken=${token}`])
      .set("X-Organization-Id", orgB.id);

    expect(res.status).toBe(403);
  });

  it("rejects requests with a forged/nonexistent organization ID", async () => {
    const token = signAccessToken({ id: userA.id, email: userA.email });
    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", [`accessToken=${token}`])
      .set("X-Organization-Id", "nonexistent-org-id-12345");

    expect(res.status).toBe(403);
  });
});