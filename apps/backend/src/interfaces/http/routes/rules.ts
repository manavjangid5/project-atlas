import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest, requireTenantRole, requirePermission} from "../middleware/tenant";
import * as ruleService from "../../../application/ruleService";

const router = Router();

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}

router.get("/rules", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await ruleService.listRules(req.tenant!.organizationId));
});

router.get("/rules/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const rule = await ruleService.getRule(req.tenant!.organizationId, paramStr(req.params.id));
  res.json(rule);
});

router.post("/rules", requireAuth, requireTenant, requirePermission("rule", "create"), async (req: TenantRequest, res) => {
  const rule = await ruleService.createRule(req.tenant!.organizationId, req.body.name);
  res.status(201).json(rule);
});

router.patch("/rules/:id", requireAuth, requireTenant, requirePermission("rule", "update"), async (req: TenantRequest, res) => {
  const rule = await ruleService.updateRule(req.tenant!.organizationId, paramStr(req.params.id), req.body);
  res.json(rule);
});

router.delete("/rules/:id", requireAuth, requireTenant, requirePermission("rule", "delete"), async (req: TenantRequest, res) => {
  await ruleService.deleteRule(req.tenant!.organizationId, paramStr(req.params.id));
  res.status(204).send();
});

router.post("/rules/:id/evaluate", requireAuth, requireTenant, requirePermission("rule", "update"), async (req: TenantRequest, res) => {
  const result = await ruleService.evaluateRule(req.tenant!.organizationId, paramStr(req.params.id), req.body.data);
  res.json(result);
});

export default router;