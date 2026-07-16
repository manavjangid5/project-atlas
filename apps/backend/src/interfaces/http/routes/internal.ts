import { Router } from "express";
import { prisma } from "../../../infrastructure/database/prismaClient";
import { createNotification } from "../../../application/notificationService";

const router = Router();

router.post("/internal/notify", async (req, res) => {
  const { runId, status } = req.body;
  const run = await prisma.executionRun.findUnique({
    where: { id: runId },
    include: { workflow: true },
  });
  if (!run) return res.status(404).json({ error: "Run not found" });

  await createNotification({
    organizationId: run.workflow.organizationId,
    title: status === "SUCCESS" ? "Workflow completed" : "Workflow finished with issues",
    message: `"${run.workflow.name}" finished: ${status}`,
    priority: status === "FAILED" ? "high" : "normal",
  });

  res.json({ ok: true });
});

export default router;