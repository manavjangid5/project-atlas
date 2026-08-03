import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest, requirePermission } from "../middleware/tenant";
import * as workflowService from "../../../application/workflowService";
import * as aiGenerator from "../../../application/aiWorkflowGeneratorService";
import { logAudit } from "../../../infrastructure/audit/auditLogger";

const router = Router();

router.post("/workflows/generate", requireAuth, requireTenant, requirePermission("workflow", "create"), async (req: TenantRequest, res) => {
  const { instruction } = req.body;
  const { name, graph } = await aiGenerator.generateWorkflowFromPrompt(req.tenant!.organizationId, instruction);

  const workflow = await workflowService.createWorkflow(req.tenant!.organizationId, name);
  const updated = await workflowService.updateWorkflowGraph(req.tenant!.organizationId, workflow.id, graph);

  await logAudit({
    action: "WORKFLOW_AI_GENERATED",
    organizationId: req.tenant!.organizationId,
    metadata: { workflowId: workflow.id, instruction },
  });

  res.status(201).json(updated);
});

router.post("/workflows/:id/suggest-next", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const workflowId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const workflow = await workflowService.getWorkflow(req.tenant!.organizationId, workflowId);
  const suggestions = await aiGenerator.suggestNextNodes(workflow.graph as any, req.body.instruction);
  res.json(suggestions);
});

export default router;