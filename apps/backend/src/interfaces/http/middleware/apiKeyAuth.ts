import { Request, Response, NextFunction } from "express";
import { validateApiKey, logApiUsage } from "../../../application/apiKeyService";

declare global {
  namespace Express {
    interface Request {
      apiKeyOrgId?: string;
    }
  }
}

const keyRequestCounts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const rawKey = req.headers["x-api-key"] as string;
  if (!rawKey) return res.status(401).json({ error: "Missing X-API-Key header" });

  const key = await validateApiKey(rawKey);
  if (!key) return res.status(401).json({ error: "Invalid or revoked API key" });

  const now = Date.now();
  const entry = keyRequestCounts.get(key.id);
  if (!entry || now > entry.resetAt) {
    keyRequestCounts.set(key.id, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > MAX_PER_WINDOW) {
      return res.status(429).json({ error: "API key rate limit exceeded (60 requests/minute)" });
    }
  }

  req.apiKeyOrgId = key.organizationId;
  res.on("finish", () => {
    logApiUsage(key.id, req.path, req.method, res.statusCode).catch(() => {});
  });
  next();
}