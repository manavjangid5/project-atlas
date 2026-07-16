import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import * as analyticsService from "../../../application/analyticsService";

const router = Router();

router.get("/analytics/overview", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const [overview, avgDuration] = await Promise.all([
    analyticsService.getOverviewStats(req.tenant!.organizationId),
    analyticsService.getAvgExecutionDuration(req.tenant!.organizationId),
  ]);
  res.json({ ...overview, avgDurationSeconds: avgDuration });
});

router.get("/analytics/node-usage", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await analyticsService.getNodeUsageBreakdown(req.tenant!.organizationId));
});

router.get("/analytics/daily-executions", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await analyticsService.getDailyExecutionCounts(req.tenant!.organizationId));
});

router.get("/analytics/active-users", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await analyticsService.getMostActiveUsers(req.tenant!.organizationId));
});

export default router;