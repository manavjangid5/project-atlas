import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, requireTenantRole, TenantRequest } from "../middleware/tenant";
import { prisma } from "../../../infrastructure/database/prismaClient";

const router = Router();

router.get(
  "/audit-logs",
  requireAuth,
  requireTenant,
  requireTenantRole("OWNER", "ADMIN"),
  async (req: TenantRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId: req.tenant!.organizationId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count({ where: { organizationId: req.tenant!.organizationId } }),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  }
);

export default router;