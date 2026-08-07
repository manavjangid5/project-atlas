import { prisma } from "./db";
import { executeNode } from "./nodeExecutors";
import type { ExecutionContext } from "./nodeExecutors";

interface GraphNode {
  id: string;
  data: { kind: string; config: Record<string, any> };
}
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data?: { branch?: "true" | "false" };
}
interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logNode(runId: string, nodeId: string, status: string, message?: string) {
  await prisma.executionLog.create({ data: { runId, nodeId, status, message } });
}

async function runNodeWithRetry(node: GraphNode, ctx: ExecutionContext, runId: string) {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    const result = await executeNode(node.data.kind, node.data.config, ctx);
    if (result.status === "SUCCESS") {
      await logNode(runId, node.id, "SUCCESS", JSON.stringify(result.output).slice(0, 500));
      if (result.output && typeof result.output === "object") {
        Object.assign(ctx.variables, { [`${node.id}_output`]: result.output });
      }
      return result;
    }
    attempt++;
    await logNode(runId, node.id, "RETRYING", `Attempt ${attempt} failed: ${result.error}`);
    if (attempt < MAX_RETRIES) {
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    } else {
      await logNode(runId, node.id, "FAILED", result.error);
      return result;
    }
  }
}

export async function executeGraph(runId: string, graph: Graph, initialPayload?: unknown, organizationId?: string) {
  await prisma.executionRun.update({ where: { id: runId }, data: { status: "RUNNING" } });

  const incoming = new Map<string, GraphEdge[]>();
  for (const node of graph.nodes) incoming.set(node.id, []);
  for (const edge of graph.edges) incoming.get(edge.target)?.push(edge);

  const completed = new Set<string>();
  const failed = new Set<string>();
  const skippedDueToFailure = new Set<string>();
  const skippedDueToBranch = new Set<string>();
  const branchDecisions = new Map<string, "true" | "false">();
  const skipped = new Set<string>();
  const ctx: ExecutionContext = { variables: initialPayload ? { trigger_payload: initialPayload } : {}, organizationId };
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  function isNodeDown(nodeId: string): boolean {
    return failed.has(nodeId) || skippedDueToFailure.has(nodeId);
  }

  function edgeSatisfied(edge: GraphEdge): "yes" | "no" | "pending" {
    if (failed.has(edge.source) || skippedDueToFailure.has(edge.source) || skippedDueToBranch.has(edge.source)) return "no";
    if (!completed.has(edge.source)) return "pending";
    if (edge.data?.branch) {
      const taken = branchDecisions.get(edge.source);
      return taken === edge.data.branch ? "yes" : "no";
    }
    return "yes";
  }

  function isReady(nodeId: string): "ready" | "skip" | "wait" {
    const edges = incoming.get(nodeId) || [];
    if (edges.length === 0) return "ready";
    const results = edges.map(edgeSatisfied);
    if (results.some((r) => r === "pending")) return "wait";
    // Ready if at least one incoming path is genuinely satisfied.
    if (results.some((r) => r === "yes")) return "ready";
    return "skip"; // every incoming path failed or took the wrong branch
  }

  let remaining = new Set(graph.nodes.map((n) => n.id));

  while (remaining.size > 0) {
    const ready: string[] = [];
    const toSkip: string[] = [];

    for (const nodeId of remaining) {
      const state = isReady(nodeId);
      if (state === "ready") ready.push(nodeId);
      else if (state === "skip") toSkip.push(nodeId);
    }

    for (const nodeId of toSkip) {
      const edges = incoming.get(nodeId) || [];
      const dueToRealFailure = edges.some((e) => isNodeDown(e.source));
      if (dueToRealFailure) {
        skippedDueToFailure.add(nodeId);
        await logNode(runId, nodeId, "SKIPPED", "Upstream node failed");
      } else {
        skippedDueToBranch.add(nodeId);
        await logNode(runId, nodeId, "SKIPPED", "Branch condition not taken (expected)");
      }
      remaining.delete(nodeId);
    }

    if (ready.length === 0) break; // nothing left to run — remaining nodes are stuck on a real cycle

    await Promise.all(
      ready.map(async (nodeId) => {
        const node = nodeMap.get(nodeId)!;
        const result = await runNodeWithRetry(node, ctx, runId);

        if (result?.status === "SUCCESS") {
          completed.add(nodeId);
          if (node.data.kind === "conditional" && result.output?.branch) {
            branchDecisions.set(nodeId, result.output.branch);
          }
        } else {
          failed.add(nodeId);
        }
        remaining.delete(nodeId);
      })
    );
  }

  const finalStatus =
  failed.size === 0 && skippedDueToFailure.size === 0
    ? "SUCCESS"
    : completed.size > 0
    ? "PARTIAL"
    : "FAILED";

  await prisma.executionRun.update({
    where: { id: runId },
    data: { status: finalStatus, finishedAt: new Date() },
  });

  return finalStatus;
}