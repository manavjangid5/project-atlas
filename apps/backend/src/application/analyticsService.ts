import { prisma } from "../infrastructure/database/prismaClient";

export async function getOverviewStats(organizationId: string) {
  const workflowIds = (
    await prisma.workflow.findMany({ where: { organizationId }, select: { id: true } })
  ).map((w) => w.id);

  const [totalRuns, successRuns, failedRuns, partialRuns, totalWorkflows, totalMembers] =
    await Promise.all([
      prisma.executionRun.count({ where: { workflowId: { in: workflowIds } } }),
      prisma.executionRun.count({ where: { workflowId: { in: workflowIds }, status: "SUCCESS" } }),
      prisma.executionRun.count({ where: { workflowId: { in: workflowIds }, status: "FAILED" } }),
      prisma.executionRun.count({ where: { workflowId: { in: workflowIds }, status: "PARTIAL" } }),
      prisma.workflow.count({ where: { organizationId, deletedAt: null } }),
      prisma.membership.count({ where: { organizationId } }),
    ]);

  return {
    totalRuns,
    successRuns,
    failedRuns,
    partialRuns,
    successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
    totalWorkflows,
    totalMembers,
  };
}

// Average duration per run, in seconds — only counts finished runs
// since PENDING/RUNNING ones have no finishedAt yet.
export async function getAvgExecutionDuration(organizationId: string) {
  const workflowIds = (
    await prisma.workflow.findMany({ where: { organizationId }, select: { id: true } })
  ).map((w) => w.id);

  const runs = await prisma.executionRun.findMany({
    where: { workflowId: { in: workflowIds }, finishedAt: { not: null } },
    select: { startedAt: true, finishedAt: true },
  });

  if (runs.length === 0) return 0;

  const totalMs = runs.reduce((sum, r) => sum + (r.finishedAt!.getTime() - r.startedAt.getTime()), 0);
  return Math.round(totalMs / runs.length / 1000); // seconds
}

// Node usage breakdown — counts how often each node "kind" appears
// across ALL saved workflow graphs in the org (not just executed
// ones), giving a picture of which node types are actually being
// designed with, not just run.
export async function getNodeUsageBreakdown(organizationId: string) {
  const workflows = await prisma.workflow.findMany({
    where: { organizationId, deletedAt: null },
    select: { graph: true },
  });

  const counts: Record<string, number> = {};
  for (const wf of workflows) {
    const graph = wf.graph as any;
    for (const node of graph?.nodes || []) {
      const kind = node.data?.kind || "unknown";
      counts[kind] = (counts[kind] || 0) + 1;
    }
  }

  return Object.entries(counts).map(([kind, count]) => ({ kind, count }));
}

// Daily execution counts for the last 14 days — feeds a simple bar
// chart of platform activity over time.
export async function getDailyExecutionCounts(organizationId: string) {
  const workflowIds = (
    await prisma.workflow.findMany({ where: { organizationId }, select: { id: true } })
  ).map((w) => w.id);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const runs = await prisma.executionRun.findMany({
    where: { workflowId: { in: workflowIds }, startedAt: { gte: fourteenDaysAgo } },
    select: { startedAt: true },
  });

  const buckets: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const run of runs) {
    const key = run.startedAt.toISOString().slice(0, 10);
    if (buckets[key] !== undefined) buckets[key]++;
  }

  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

export async function getMostActiveUsers(organizationId: string) {
  const results = await prisma.auditLog.groupBy({
    by: ["userId"],
    where: { organizationId, userId: { not: null } },
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 5,
  });

  const userIds = results.map((r) => r.userId!).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });

  return results.map((r) => ({
    user: users.find((u) => u.id === r.userId),
    actionCount: r._count.userId,
  }));
}