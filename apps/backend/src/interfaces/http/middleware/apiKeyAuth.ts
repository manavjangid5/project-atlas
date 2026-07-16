import { Request, Response, NextFunction } from "express";
import { validateApiKey, logApiUsage } from "../../../application/apiKeyService";

declare global {
  namespace Express {
    interface Request {
      apiKeyOrgId?: string;
    }
  }
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const rawKey = req.headers["x-api-key"] as string;
  if (!rawKey) return res.status(401).json({ error: "Missing X-API-Key header" });

  const key = await validateApiKey(rawKey);
  if (!key) return res.status(401).json({ error: "Invalid or revoked API key" });

  req.apiKeyOrgId = key.organizationId;

  res.on("finish", () => {
    logApiUsage(key.id, req.path, req.method, res.statusCode).catch(() => {});
  });

  next();
}