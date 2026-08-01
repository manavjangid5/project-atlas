import { prisma } from "../infrastructure/database/prismaClient";
import { publishMessage } from "../infrastructure/rabbitmq/rabbitmqClient";
import { AppError } from "../interfaces/http/middleware/errorHandler";
import type { Prisma } from "@atlas/database";
import { logAudit } from "../infrastructure/audit/auditLogger";
import { createNotification } from "./notificationService";
import crypto from "crypto";
import { isFlagEnabled } from "./featureFlagService";
export async function listWorkflows(organizationId: string) {
  return prisma.workflow.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWorkflow(organizationId: string, id: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!workflow) throw new AppError(404, "Workflow not found");
  return workflow;
}

export async function createWorkflow(organizationId: string, name: string) {
  return prisma.workflow.create({
    data: {
      name,
      organizationId,
      graph: { nodes: [], edges: [] } as unknown as Prisma.InputJsonValue,
      webhookToken: crypto.randomBytes(20).toString("hex"),
    },
  });
}

// Every graph save also writes a version snapshot — satisfies the
// Version Control module (4.14) without extra UI work: diff/rollback
// can be built later purely by reading this table.
export async function updateWorkflowGraph(
  organizationId: string,
  id: string,
  graph: unknown
) {
  const workflow = await getWorkflow(organizationId, id);

  return prisma.$transaction(async (tx) => {
    const lastVersion = await tx.workflowVersion.findFirst({
      where: { workflowId: id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;

    await tx.workflowVersion.create({
      data: {
        workflowId: id,
        graph: graph as Prisma.InputJsonValue,
        version: nextVersion,
      },
    });
await logAudit({
    action: "WORKFLOW_UPDATED",
    organizationId,
    metadata: { workflowId: id },
  });
    return tx.workflow.update({
      where: { id: workflow.id },
      data: { graph: graph as Prisma.InputJsonValue },
    });
  });
}

export async function softDeleteWorkflow(organizationId: string, id: string) {
  await getWorkflow(organizationId, id);
  return prisma.workflow.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// Triggers execution: creates a PENDING run record immediately (so the
// UI has something to show right away), then publishes to Kafka for
// the worker to actually process asynchronously. This separation is
// what makes the engine non-blocking and horizontally scalable.
export async function triggerWorkflowRun(organizationId: string, workflowId: string, initialPayload?: unknown) {
  const workflow = await getWorkflow(organizationId, workflowId);

  const graph = workflow.graph as any;
  const hasAiNode = graph?.nodes?.some((n: any) => n.data?.kind === "ai_prompt");
  if (hasAiNode) {
    const aiEnabled = await isFlagEnabled("ai_node_enabled", organizationId);
    if (!aiEnabled) throw new AppError(403, "AI node execution is disabled for this organization");
  }
  const run = await prisma.executionRun.create({ data: { workflowId: workflow.id, status: "PENDING" } });

  await publishMessage({
    runId: run.id,
    workflowId: workflow.id,
    organizationId,
    graph: workflow.graph,
    initialPayload: initialPayload ?? null,
  });

  await logAudit({ action: "WORKFLOW_EXECUTED", organizationId, metadata: { workflowId: workflow.id, runId: run.id } });
  await createNotification({
    organizationId,
    title: "Workflow started",
    message: `"${workflow.name}" is running (run ${run.id.slice(0, 8)})`,
    priority: "low",
  });

  return run;
}
export async function triggerByWebhookToken(token: string, payload: unknown) {
  const workflow = await prisma.workflow.findFirst({ where: { webhookToken: token, deletedAt: null } as any });
  if (!workflow || workflow.deletedAt) throw new AppError(404, "Webhook not found or inactive");
  return triggerWorkflowRun(workflow.organizationId, workflow.id, payload);
}
export async function listRuns(organizationId: string, workflowId: string) {
  await getWorkflow(organizationId, workflowId);
  return prisma.executionRun.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
}

export async function getRun(organizationId: string, workflowId: string, runId: string) {
  await getWorkflow(organizationId, workflowId);
  const run = await prisma.executionRun.findFirst({
    where: { id: runId, workflowId },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) throw new AppError(404, "Run not found");
  return run;
}

export async function listVersions(organizationId: string, workflowId: string, page = 1, limit = 8) {
  await getWorkflow(organizationId, workflowId);
  const [versions, total] = await Promise.all([
    prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workflowVersion.count({ where: { workflowId } }),
  ]);
  return { versions, total, page, pages: Math.ceil(total / limit) };
}

export async function restoreVersion(organizationId: string, workflowId: string, versionId: string) {
  const workflow = await getWorkflow(organizationId, workflowId);
  const version = await prisma.workflowVersion.findFirst({ where: { id: versionId, workflowId } });
  if (!version) throw new AppError(404, "Version not found");
  return updateWorkflowGraph(organizationId, workflow.id, version.graph); // reuses existing snapshot logic, so restoring itself creates a new version too
}