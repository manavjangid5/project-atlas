import crypto from "crypto";
import { prisma } from "../infrastructure/database/prismaClient";
import { AppError } from "../interfaces/http/middleware/errorHandler";

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(organizationId: string, name: string) {
  const rawKey = `atlas_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 14);

  await prisma.apiKey.create({
    data: { name, keyHash, keyPrefix, organizationId },
  });

  // Raw key is only ever returned once, at creation time — matches
  // standard practice (Stripe, GitHub tokens, etc.) since we only
  // store the hash from here on and can't show it again.
  return { rawKey, keyPrefix };
}

export async function listApiKeys(organizationId: string) {
  return prisma.apiKey.findMany({
    where: { organizationId },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiKey(organizationId: string, id: string) {
  const key = await prisma.apiKey.findFirst({ where: { id, organizationId } });
  if (!key) throw new AppError(404, "API key not found");
  return prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}

export async function validateApiKey(rawKey: string) {
  const keyHash = hashKey(rawKey);
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!key || key.revokedAt) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key;
}

export async function logApiUsage(apiKeyId: string, endpoint: string, method: string, statusCode: number) {
  await prisma.apiUsageLog.create({ data: { apiKeyId, endpoint, method, statusCode } });
}

export async function getUsageStats(organizationId: string) {
  const keys = await prisma.apiKey.findMany({ where: { organizationId }, select: { id: true } });
  const keyIds = keys.map((k) => k.id);

  const total = await prisma.apiUsageLog.count({ where: { apiKeyId: { in: keyIds } } });
  const last24h = await prisma.apiUsageLog.count({
    where: { apiKeyId: { in: keyIds }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  return { totalRequests: total, requestsLast24h: last24h };
}