import { Router } from "express";
import { requireApiKey } from "../middleware/apiKeyAuth";
import * as workflowService from "../../../application/workflowService";

const router = Router();

// This is the real external API surface the API Keys module was built
// for — an integration holding a valid key can list and trigger
// workflows without ever having a browser session or cookies.
router.get("/public/workflows", requireApiKey, async (req, res) => {
  const workflows = await workflowService.listWorkflows(req.apiKeyOrgId!);
  res.json(workflows);
});

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}
router.post("/public/workflows/:id/run", requireApiKey, async (req, res) => {
  const run = await workflowService.triggerWorkflowRun(req.apiKeyOrgId!, paramStr(req.params.id), req.body);
  res.status(202).json({ runId: run.id, status: run.status });
});

export default router;