import { Router } from "express";
import * as workflowService from "../../../application/workflowService";

const router = Router();

router.post("/webhooks/:token", async (req, res) => {
  const run = await workflowService.triggerByWebhookToken(req.params.token, req.body);
  res.status(202).json({ runId: run.id, status: run.status });
});

export default router;