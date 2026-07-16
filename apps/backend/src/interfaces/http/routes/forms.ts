import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import * as formService from "../../../application/formService";

const router = Router();

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}

router.get("/forms", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await formService.listForms(req.tenant!.organizationId));
});

router.get("/forms/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await formService.getForm(req.tenant!.organizationId, paramStr(req.params.id)));
});

router.post("/forms", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const form = await formService.createForm(req.tenant!.organizationId, req.body.name);
  res.status(201).json(form);
});

router.patch("/forms/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const form = await formService.updateFormFields(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    req.body.fields
  );
  res.json(form);
});

router.post("/forms/:id/submit", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const submission = await formService.submitForm(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    req.body.data,
    req.user?.id
  );
  res.status(201).json(submission);
});

router.get("/forms/:id/submissions", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await formService.listSubmissions(req.tenant!.organizationId, paramStr(req.params.id)));
});

export default router;