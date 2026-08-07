import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest, requireTenantRole, requirePermission } from "../middleware/tenant";
import * as formService from "../../../application/formService";
import { validateBody } from "../middleware/validate";
import { createFormSchema, updateFormFieldsSchema, submitFormSchema } from "../../../domain/validationSchemas";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });


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

router.post("/forms", requireAuth, requireTenant, requirePermission("form", "create"), validateBody(createFormSchema), async (req: TenantRequest, res) => {
  const form = await formService.createForm(req.tenant!.organizationId, req.body.name);
  res.status(201).json(form);
});

router.patch("/forms/:id", requireAuth, requireTenant, requirePermission("form", "update"), validateBody(updateFormFieldsSchema), async (req: TenantRequest, res) => {
  const form = await formService.updateFormFields(
    req.tenant!.organizationId,
    paramStr(req.params.id),
    req.body.fields
  );
  res.json(form);
});

router.post("/forms/:id/submit",
  requireAuth,
  requireTenant,
  requirePermission("form", "submit"),
  upload.any(), // accepts any file fields alongside regular form data
  async (req: TenantRequest, res) => {
    const rawData = req.body.data ? JSON.parse(req.body.data) : req.body;
    const files = (req.files as Express.Multer.File[]) || [];
    const submission = await formService.submitForm(
      req.tenant!.organizationId,
      paramStr(req.params.id),
      rawData,
      req.user?.id,
      files
    );
    res.status(201).json(submission);
  }
);

router.get("/forms/:id/submissions", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await formService.listSubmissions(req.tenant!.organizationId, paramStr(req.params.id)));
});

export default router;