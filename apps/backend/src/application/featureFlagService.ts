import crypto from "crypto";
import { prisma } from "../infrastructure/database/prismaClient";
import { AppError } from "../interfaces/http/middleware/errorHandler";

export async function listFlags() {
  return prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createFlag(key: string, description?: string) {
  const existing = await prisma.featureFlag.findUnique({ where: { key } });
  if (existing) throw new AppError(409, "A flag with this key already exists");
  return prisma.featureFlag.create({ data: { key, description } });
}

export async function updateFlag(
  id: string,
  updates: { isGloballyEnabled?: boolean; rolloutPercentage?: number; targetOrgIds?: string[] }
) {
  return prisma.featureFlag.update({ where: { id }, data: updates });
}

export async function deleteFlag(id: string) {
  return prisma.featureFlag.delete({ where: { id } });
}

// Deterministic hash-based rollout: the same org always gets the
// same in/out result for a given percentage, rather than randomly
// flipping on every check — this is what makes percentage rollouts
// usable in practice (a user doesn't see a feature flicker on/off
// between requests).
function isInRolloutBucket(orgId: string, flagKey: string, percentage: number): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  const hash = crypto.createHash("md5").update(`${flagKey}:${orgId}`).digest("hex");
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  return bucket < percentage;
}

export async function isFlagEnabled(key: string, organizationId: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) return false;
  if (flag.targetOrgIds.includes(organizationId)) return true;
  if (flag.isGloballyEnabled) return true;
  return isInRolloutBucket(organizationId, key, flag.rolloutPercentage);
}

export async function evaluateAllFlags(organizationId: string): Promise<Record<string, boolean>> {
  const flags = await prisma.featureFlag.findMany();
  const result: Record<string, boolean> = {};
  for (const flag of flags) {
    result[flag.key] =
      flag.targetOrgIds.includes(organizationId) ||
      flag.isGloballyEnabled ||
      isInRolloutBucket(organizationId, flag.key, flag.rolloutPercentage);
  }
  return result;
}