import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import * as flagService from "../../../application/featureFlagService";

const router = Router();

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}

router.get("/feature-flags", requireAuth, async (_req, res) => {
  res.json(await flagService.listFlags());
});

router.post("/feature-flags", requireAuth, async (req, res) => {
  const flag = await flagService.createFlag(req.body.key, req.body.description);
  res.status(201).json(flag);
});

router.patch("/feature-flags/:id", requireAuth, async (req, res) => {
  const flag = await flagService.updateFlag(paramStr(req.params.id), req.body);
  res.json(flag);
});

router.delete("/feature-flags/:id", requireAuth, async (req, res) => {
  await flagService.deleteFlag(paramStr(req.params.id));
  res.status(204).send();
});

// This is the endpoint the frontend actually calls on app load — it
// returns resolved true/false per flag for the CURRENT org, so the
// UI never needs to know about percentages/targeting itself.
router.get("/feature-flags/evaluate", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await flagService.evaluateAllFlags(req.tenant!.organizationId));
});

export default router;