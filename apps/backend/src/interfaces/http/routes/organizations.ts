import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireTenant, requireTenantRole, TenantRequest } from "../middleware/tenant";
import * as orgService from "../../../application/organizationService";

const router = Router();

router.post("/organizations", requireAuth, async (req: AuthedRequest, res) => {
  const { name } = req.body;
  const org = await orgService.createOrganization(req.user!.id, name);
  res.status(201).json(org);
});

router.get("/organizations", requireAuth, async (req: AuthedRequest, res) => {
  const orgs = await orgService.listUserOrganizations(req.user!.id);
  res.json(orgs);
});

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
  const result = await orgService.acceptInvitation(req.params.token, req.user!.id);
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
      req.params.userId,
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
    await orgService.removeMember(req.tenant!.organizationId, req.params.userId);
    res.status(204).send();
  }
);

export default router;