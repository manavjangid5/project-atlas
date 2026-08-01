import { Router } from "express";
import { prisma } from "../../../infrastructure/database/prismaClient";
import { getChannel } from "../../../infrastructure/rabbitmq/rabbitmqClient";

const router = Router();

router.get("/health", async (_req, res) => {
  const checks = { db: "unknown", queue: "unknown" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "connected";
  } catch {
    checks.db = "disconnected";
  }
  try {
    await getChannel();
    checks.queue = "connected";
  } catch {
    checks.queue = "disconnected";
  }
  const healthy = checks.db === "connected" && checks.queue === "connected";
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", ...checks, timestamp: new Date().toISOString() });
});

export default router;