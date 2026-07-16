import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, requireTenantRole, TenantRequest } from "../middleware/tenant";
import * as apiKeyService from "../../../application/apiKeyService";

const router = Router();

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}

router.get("/api-keys", requireAuth, requireTenant, requireTenantRole("OWNER", "ADMIN"), async (req: TenantRequest, res) => {
  res.json(await apiKeyService.listApiKeys(req.tenant!.organizationId));
});

router.post("/api-keys", requireAuth, requireTenant, requireTenantRole("OWNER", "ADMIN"), async (req: TenantRequest, res) => {
  const result = await apiKeyService.createApiKey(req.tenant!.organizationId, req.body.name);
  res.status(201).json(result);
});

router.delete("/api-keys/:id", requireAuth, requireTenant, requireTenantRole("OWNER", "ADMIN"), async (req: TenantRequest, res) => {
  await apiKeyService.revokeApiKey(req.tenant!.organizationId, paramStr(req.params.id));
  res.status(204).send();
});

router.get("/api-keys/usage", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await apiKeyService.getUsageStats(req.tenant!.organizationId));
});

export default router;