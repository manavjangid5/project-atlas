import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import { globalSearch } from "../../../application/searchService";

const router = Router();

router.get("/search", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const query = (req.query.q as string) || "";
  const results = await globalSearch(req.tenant!.organizationId, query);
  res.json(results);
});

export default router;