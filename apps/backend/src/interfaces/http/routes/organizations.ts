import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireTenant, requireTenantRole, TenantRequest } from "../middleware/tenant";
import * as orgService from "../../../application/organizationService";
import { prisma } from "../../../infrastructure/database/prismaClient";

const router = Router();

function paramStr(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value as string);
}

router.post("/organizations", requireAuth, async (req: AuthedRequest, res) => {
  const { name } = req.body;
  const org = await orgService.createOrganization(req.user!.id, name);
  res.status(201).json(org);
});

router.get("/organizations", requireAuth, async (req: AuthedRequest, res) => {
  const orgs = await orgService.listUserOrganizations(req.user!.id);
  res.json(orgs);
});
router.get("/organizations/members", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const members = await prisma.membership.findMany({
    where: { organizationId: req.tenant!.organizationId },
    include: { user: { select: { email: true, name: true } } },
  });
  res.json(members);
});
router.patch(
  "/organizations/:orgId",
  requireAuth,
  requireTenant,
  requireTenantRole("OWNER"),
  async (req: TenantRequest, res) => {
    const updated = await prisma.organization.update({
      where: { id: req.tenant!.organizationId },
      data: { name: req.body.name },
    });
    res.json(updated);
  }
);
router.post(
  "/organizations/:orgId/invitations",
  requireAuth,
  requireTenant,
  requireTenantRole("OWNER", "ADMIN"),
  async (req: TenantRequest, res) => {
    const { email, role } = req.body;
    const invite = await orgService.inviteMember(
      req.tenant!.organizationId,
      req.user!.id,
      email,
      role
    );
    res.status(201).json({ token: invite.token, expiresAt: invite.expiresAt });
  }
);



router.post("/invitations/:token/accept", requireAuth, async (req: AuthedRequest, res) => {
  const result = await orgService.acceptInvitation( paramStr(req.params.token), req.user!.id);
  res.json(result);
});

router.patch(
  "/organizations/:orgId/members/:userId/role",
  requireAuth,
  requireTenant,
  requireTenantRole("OWNER"),
  async (req: TenantRequest, res) => {
    const updated = await orgService.updateMemberRole(
      req.tenant!.organizationId,
       paramStr(req.params.userId),
      req.body.role
    );
    res.json(updated);
  }
);

router.delete(
  "/organizations/:orgId/members/:userId",
  requireAuth,
  requireTenant,
  requireTenantRole("OWNER", "ADMIN"),
  async (req: TenantRequest, res) => {
    await orgService.removeMember(req.tenant!.organizationId,  paramStr(req.params.userId));
    res.status(204).send();
  }
);

export default router;