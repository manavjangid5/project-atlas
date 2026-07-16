import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import * as notificationService from "../../../application/notificationService";

const router = Router();

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}

router.get("/notifications", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const notifications = await notificationService.listNotifications(
    req.tenant!.organizationId,
    req.user!.id
  );
  res.json(notifications);
});

router.patch("/notifications/:id/read", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const updated = await notificationService.markAsRead(paramStr(req.params.id));
  res.json(updated);
});

router.post("/notifications/read-all", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  await notificationService.markAllAsRead(req.tenant!.organizationId, req.user!.id);
  res.json({ ok: true });
});

export default router;