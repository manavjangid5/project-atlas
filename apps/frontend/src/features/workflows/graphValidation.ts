import type { Node, Edge } from "reactflow";

const INCOMPATIBLE_CHAINS: [string, string][] = [
  ["delay", "conditional"], // Delay produces no meaningful data for a condition to test
];
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGraph(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];

  // Cycle detection via DFS
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) adjacency.get(e.source)?.push(e.target);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function hasCycle(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const isIncompatible = INCOMPATIBLE_CHAINS.some(
      ([from, to]) => sourceNode.data.kind === from && targetNode.data.kind === to
    );
    if (isIncompatible) {
      errors.push(
        `"${sourceNode.data.label}" (${sourceNode.data.kind}) → "${targetNode.data.label}" (${targetNode.data.kind}) may not produce compatible data for this connection.`
      );
    }
  }
  
  for (const n of nodes) {
    if (hasCycle(n.id)) {
      errors.push("This workflow contains a cycle — nodes cannot form a loop back to themselves.");
      break;
    }
  }

  // Conditional nodes must have both true/false branches connected (or explicitly flagged as incomplete)
  for (const n of nodes) {
    if (n.data?.kind === "conditional") {
      const outgoing = edges.filter((e) => e.source === n.id);
      const hasTrue = outgoing.some((e) => e.data?.branch === "true");
      const hasFalse = outgoing.some((e) => e.data?.branch === "false");
      if (!hasTrue && !hasFalse) {
        errors.push(`Conditional node "${n.data.label}" has no connected branches.`);
      }
    }
  }

  // Orphan nodes (no connections at all, in a graph with 2+ nodes) — warning, not blocking
  if (nodes.length > 1) {
    for (const n of nodes) {
      const connected = edges.some((e) => e.source === n.id || e.target === n.id);
      if (!connected) errors.push(`Node "${n.data.label}" is not connected to anything.`);
    }
  }

  return { valid: errors.length === 0, errors };
}