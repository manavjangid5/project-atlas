import { prisma } from "../infrastructure/database/prismaClient";
import { logAudit } from "../infrastructure/audit/auditLogger";
import { evaluateConditions } from "./ruleEvaluator";
import { AppError } from "../interfaces/http/middleware/errorHandler";
import type { Prisma } from "@prisma/client";

export async function listRules(organizationId: string) {
  return prisma.rule.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } });
}

export async function getRule(organizationId: string, id: string) {
  const rule = await prisma.rule.findFirst({ where: { id, organizationId } });
  if (!rule) throw new AppError(404, "Rule not found");
  return rule;
}

export async function createRule(organizationId: string, name: string) {
  return prisma.rule.create({
    data: {
      name,
      organizationId,
      conditions: { type: "group", logic: "AND", children: [] } as unknown as Prisma.InputJsonValue,
      action: { kind: "NONE" } as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function updateRule(
  organizationId: string,
  id: string,
  updates: { conditions?: unknown; action?: unknown; isActive?: boolean }
) {
  await getRule(organizationId, id);
  const updated = await prisma.rule.update({
    where: { id },
    data: {
      ...(updates.conditions !== undefined && { conditions: updates.conditions as Prisma.InputJsonValue }),
      ...(updates.action !== undefined && { action: updates.action as Prisma.InputJsonValue }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  });
  await logAudit({ action: "RULE_UPDATED", organizationId, metadata: { ruleId: id } });
  return updated;
}

export async function deleteRule(organizationId: string, id: string) {
  await getRule(organizationId, id);
  return prisma.rule.delete({ where: { id } });
}

// Evaluates a single rule against sample data — used both by the
// "test this rule" UI button and, potentially, by other modules
// (e.g. a workflow node type that checks a named rule) later.
export async function evaluateRule(organizationId: string, id: string, data: Record<string, any>) {
  const rule = await getRule(organizationId, id);
  const matched = evaluateConditions(rule.conditions as any, data);
  return { matched, action: matched ? rule.action : null };
}

// Runs every active rule in the org against a data payload — this is
// the entry point other parts of the system (e.g. a form submission
// or workflow event) would call to let stored rules drive behavior.
export async function evaluateAllActiveRules(organizationId: string, data: Record<string, any>) {
  const rules = await prisma.rule.findMany({ where: { organizationId, isActive: true } });
  const results = rules
    .map((rule) => ({
      ruleId: rule.id,
      name: rule.name,
      matched: evaluateConditions(rule.conditions as any, data),
      action: rule.action,
    }))
    .filter((r) => r.matched);
  return results;
}