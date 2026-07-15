import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import * as workflowService from "../../../application/workflowService";

const router = Router();

// Express 5's param typing can widen to string | string[] in some
// route configurations. Since none of our routes actually use
// repeating/array params, this helper safely narrows to a single string.
function paramStr(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value as string);
}

router.get("/workflows", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const workflows = await workflowService.listWorkflows(req.tenant!.organizationId);
  res.json(workflows);
});

router.get("/workflows/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const wf = await workflowService.getWorkflow(req.tenant!.organizationId, paramStr(req.params.id));
  res.json(wf);
});

router.post("/workflows", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const wf = await workflowService.createWorkflow(req.tenant!.organizationId, req.body.name);
  res.status(201).json(wf);
});

router.patch("/workflows/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const wf = await workflowService.updateWorkflowGraph(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    req.body.graph
  );
  res.json(wf);
});

router.delete("/workflows/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  await workflowService.softDeleteWorkflow(req.tenant!.organizationId, paramStr(req.params.id));
  res.status(204).send();
});

router.post("/workflows/:id/run", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const run = await workflowService.triggerWorkflowRun(req.tenant!.organizationId, paramStr(req.params.id));
  res.status(202).json({ runId: run.id, status: run.status });
});

router.get("/workflows/:id/runs", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const runs = await workflowService.listRuns(req.tenant!.organizationId, paramStr(req.params.id));
  res.json(runs);
});

router.get("/workflows/:id/runs/:runId", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const run = await workflowService.getRun(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    paramStr(req.params.runId)
  );
  res.json(run);
});

export default router;