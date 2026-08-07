import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest, requireTenantRole, requirePermission } from "../middleware/tenant";
import * as workflowService from "../../../application/workflowService";
import { validateBody } from "../middleware/validate";
import { createWorkflowSchema, updateWorkflowGraphSchema } from "../../../domain/validationSchemas";
import { loadScheduledWorkflows } from "../../../infrastructure/scheduler/cronScheduler";

const router = Router();

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

router.post("/workflows", requireAuth, requireTenant, requirePermission("workflow", "create"), validateBody(createWorkflowSchema), async (req, res) => {
  const wf = await workflowService.createWorkflow(req.tenant!.organizationId, req.body.name);
  res.status(201).json(wf);
});

router.patch("/workflows/:id", requireAuth, requireTenant, requirePermission("workflow", "update"), validateBody(updateWorkflowGraphSchema), async (req, res) => {
  const wf = await workflowService.updateWorkflowGraph(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    req.body.graph
  );
  res.json(wf);
});

router.delete("/workflows/:id", requireAuth, requireTenant, requirePermission("workflow", "delete"), async (req: TenantRequest, res) => {
  await workflowService.softDeleteWorkflow(req.tenant!.organizationId, paramStr(req.params.id));
  res.status(204).send();
});

router.post("/workflows/:id/run", requireAuth, requireTenant, requirePermission("workflow", "run"), async (req, res) => {
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

router.get("/workflows/:id/versions", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const result = await workflowService.listVersions(req.tenant!.organizationId, paramStr(req.params.id), page, 8);
  res.json(result);
});
router.post("/workflows/:id/versions/:versionId/restore", requireAuth, requireTenant, requirePermission("workflow", "restoreVersion"), async (req: TenantRequest, res) => {
  const wf = await workflowService.restoreVersion(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    paramStr(req.params.versionId)
  );
  res.json(wf);
});
router.patch("/workflows/:id/schedule", requireAuth, requireTenant, requirePermission("workflow", "update"), async (req, res) => {
  const wf = await workflowService.updateWorkflowSchedule(req.tenant!.organizationId, paramStr(req.params.id), req.body.cronSchedule);
  await loadScheduledWorkflows(); // re-sync in-memory cron jobs
  res.json(wf);
});

export default router;