import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest } from "../middleware/tenant";
import * as fileService from "../../../application/fileService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v as string);
}

router.get("/files", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  res.json(await fileService.listFiles(req.tenant!.organizationId));
});

router.post("/files", requireAuth, requireTenant, upload.single("file"), async (req: TenantRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  const asset = await fileService.uploadFile(req.tenant!.organizationId, req.user!.id, req.file, req.body.replacesFileId);
  res.status(201).json(asset);
});

router.get("/files/:id/download-url", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const url = await fileService.getDownloadUrl(req.tenant!.organizationId, paramStr(req.params.id));
  res.json({ url });
});

router.delete("/files/:id", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  await fileService.softDeleteFile(req.tenant!.organizationId, paramStr(req.params.id));
  res.status(204).send();
});

router.post("/files/:id/restore", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const restored = await fileService.restoreFile(req.tenant!.organizationId, paramStr(req.params.id));
  res.json(restored);
});

router.post("/files/:id/share", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const link = await fileService.createShareLink(req.tenant!.organizationId, paramStr(req.params.id), req.body.expiresInHours);
  res.status(201).json({ token: link.token, expiresAt: link.expiresAt });
});

// Public route — no auth, resolves an expiring share link
router.get("/share/:token", async (req, res) => {
  const result = await fileService.resolveShareLink(paramStr(req.params.token));
  res.json(result);
});

export default router;