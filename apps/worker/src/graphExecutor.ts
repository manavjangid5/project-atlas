import { prisma } from "./db";
import { executeNode } from "./nodeExecutors";
import type { ExecutionContext } from "./nodeExecutors";
import axios from "axios";
interface GraphNode {
  id: string;
  data: { kind: string; config: Record<string, any> };
}
interface GraphEdge {
  id: string;
  source: string;
  target: string;
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

function buildAdjacency(graph: Graph) {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const node of graph.nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
  }
  return { incoming, outgoing };
}

async function logNode(runId: string, nodeId: string, status: string, message?: string) {
  await prisma.executionLog.create({
    data: { runId, nodeId, status, message },
  });
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
      await sleep(BASE_BACKOFF_MS * 2 ** attempt); // exponential backoff
    } else {
      await logNode(runId, node.id, "FAILED", result.error);
      return result;
    }
  }
}

// Walks the graph in topological order, running independent branches
// (nodes whose dependencies are already satisfied) in parallel via
// Promise.all — this is what satisfies "parallel execution of
// independent branches" from the spec, without needing a full DAG
// scheduler library.
export async function executeGraph(runId: string, graph: Graph) {
  await prisma.executionRun.update({ where: { id: runId }, data: { status: "RUNNING" } });

  const { incoming, outgoing } = buildAdjacency(graph);
  const completed = new Set<string>();
  const failed = new Set<string>();
  const ctx: ExecutionContext = { variables: {} };

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  async function isReady(nodeId: string) {
    const deps = incoming.get(nodeId) || [];
    return deps.every((d) => completed.has(d) || failed.has(d));
  }

  let remaining = new Set(graph.nodes.map((n) => n.id));

  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const nodeId of remaining) {
      if (await isReady(nodeId)) ready.push(nodeId);
    }

    if (ready.length === 0) break; // cycle or unresolved dependency — stop safely

    await Promise.all(
      ready.map(async (nodeId) => {
        const node = nodeMap.get(nodeId)!;
        const depsFailed = (incoming.get(nodeId) || []).some((d) => failed.has(d));
        if (depsFailed) {
          await logNode(runId, nodeId, "SKIPPED", "Upstream node failed");
          failed.add(nodeId);
          remaining.delete(nodeId);
          return;
        }

        const result = await runNodeWithRetry(node, ctx, runId);
        if (result?.status === "SUCCESS") completed.add(nodeId);
        else failed.add(nodeId);
        remaining.delete(nodeId);
      })
    );
  }

  const finalStatus = failed.size === 0 ? "SUCCESS" : completed.size > 0 ? "PARTIAL" : "FAILED";

  await prisma.executionRun.update({
    where: { id: runId },
    data: { status: finalStatus, finishedAt: new Date() },
  });

  try {
    await axios.post(`${process.env.BACKEND_URL || "http://localhost:4000"}/api/v1/internal/notify`, {
      runId,
      status: finalStatus,
    });
  } catch (err) {
    console.error("Failed to notify backend of run completion:", err);
  }

  return finalStatus;
}