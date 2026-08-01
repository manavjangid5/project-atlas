// import { PrismaClient } from "@prisma/client";
import { PrismaClient } from "@atlas/database";
import * as authService from "./authService";

const prisma = new PrismaClient();

describe("Refresh token rotation & reuse detection (integration)", () => {
  const email = `refresh-test-${Date.now()}@test.com`;
  const password = "TestPass123!";

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  it("issues a fresh token pair on register", async () => {
    const { accessToken, refreshToken } = await authService.register(email, password);
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it("rotates the refresh token on use — old token becomes invalid", async () => {
    const { refreshToken: firstToken } = await authService.login(email, password);
    const { refreshToken: secondToken } = await authService.refresh(firstToken);

    expect(secondToken).not.toBe(firstToken);

    // The rotated-away token must now be rejected if used again.
    await expect(authService.refresh(firstToken)).rejects.toThrow();
  });

  it("reuse of a revoked token revokes the entire token family (all sessions)", async () => {
    const { refreshToken: tokenA } = await authService.login(email, password);
    const { refreshToken: tokenB } = await authService.refresh(tokenA); // tokenA now revoked, tokenB is current

    // Replay the already-revoked tokenA — this is the attack scenario:
    // a stolen old token being reused.
    await expect(authService.refresh(tokenA)).rejects.toThrow(/reuse detected/i);

    // Because reuse was detected, tokenB (the legitimately current token)
    // must ALSO now be revoked — the whole family dies, not just tokenA.
    await expect(authService.refresh(tokenB)).rejects.toThrow();
  });
});