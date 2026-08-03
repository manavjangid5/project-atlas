import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@atlas/database";
import { AppError } from "../interfaces/http/middleware/errorHandler";
import crypto from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const VALID_KINDS = ["http_request", "delay", "conditional", "slack", "ai_prompt", "webhook", "github", "email", "switch", "loop", "database_query"];

// This is the core of the "AI generates an entire workflow" spec
// requirement (4.4). We constrain Gemini to a strict JSON schema
// matching our existing WorkflowGraph shape, then validate every
// node kind against the real, executable node types — so the AI
// can never generate a graph the engine doesn't actually support.
const SYSTEM_PROMPT = `You are a workflow graph generator for an automation platform similar to n8n/Zapier.
Given a natural-language instruction, output ONLY a JSON object (no markdown, no explanation) with this exact shape:

{
  "nodes": [
    { "id": "node-1", "type": "custom", "position": { "x": 100, "y": 100 }, "data": { "label": "Human readable label", "kind": "<one of: ${VALID_KINDS.join(", ")}>", "config": { ...node-specific config } } }
  ],
  "edges": [
    { "id": "edge-1", "source": "node-1", "target": "node-2" }
  ]
}

Node kind config shapes:
- http_request: { "method": "GET"|"POST", "url": "string" }
- delay: { "durationMs": number }
- conditional: { "field": "string", "operator": "equals"|"notEquals"|"greaterThan"|"lessThan"|"contains", "value": "string" }
- slack: { "webhookUrl": "string", "message": "string" }
- ai_prompt: { "prompt": "string, can reference {node-id_output}" }
- webhook: { "url": "string", "method": "POST" }
- github: { "owner": "string", "repo": "string", "action": "recent_commits"|"latest_release" }
- email: { "to": "string", "subject": "string", "body": "string" }
- switch: { "field": "string" }
- loop: { "arrayVariable": "string", "maxIterations": number }
- database_query: { "table": "string", "limit": number }

Position nodes left-to-right with x incrementing by 300 per step. Generate 2-6 nodes for a typical instruction. Only output the raw JSON object, nothing else.`;

interface GeneratedGraph {
  nodes: any[];
  edges: any[];
}

function validateGeneratedGraph(graph: any): GeneratedGraph {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new AppError(422, "AI did not return a valid graph structure");
  }
  for (const node of graph.nodes) {
    if (!node.id || !node.data?.kind || !VALID_KINDS.includes(node.data.kind)) {
      throw new AppError(422, `AI generated an invalid or unsupported node kind: ${node.data?.kind}`);
    }
  }
  const nodeIds = new Set(graph.nodes.map((n: any) => n.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new AppError(422, "AI generated an edge referencing a non-existent node");
    }
  }
  return graph;
}

export async function generateWorkflowFromPrompt(
  organizationId: string,
  instruction: string
): Promise<{ name: string; graph: GeneratedGraph }> {
  if (!instruction?.trim()) throw new AppError(400, "Instruction is required");
  if (!process.env.GEMINI_API_KEY) throw new AppError(503, "AI generation is not configured");

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nInstruction: ${instruction}`);

  let rawText = result.response.text().trim();
  // Gemini sometimes wraps JSON in markdown fences despite instructions — strip defensively.
  rawText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AppError(422, "AI response was not valid JSON — try rephrasing the instruction");
  }

  const graph = validateGeneratedGraph(parsed);

  // Suggest a short workflow name from the instruction itself, capped for sanity.
  const name = instruction.trim().slice(0, 60);

  return { name, graph };
}

// Suggests likely next node(s) given the current partial graph — the
// other half of spec 4.4 ("suggest the next nodes to add").
export async function suggestNextNodes(
  currentGraph: GeneratedGraph,
  instruction?: string
): Promise<{ kind: string; label: string; reason: string }[]> {
  if (!process.env.GEMINI_API_KEY) throw new AppError(503, "AI generation is not configured");

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const prompt = `Given this partial workflow graph: ${JSON.stringify(currentGraph)}
${instruction ? `The user's overall goal: ${instruction}` : ""}
Suggest up to 3 logical next node(s) to add. Valid kinds: ${VALID_KINDS.join(", ")}.
Output ONLY a JSON array: [{ "kind": "...", "label": "...", "reason": "one short sentence" }]`;

  const result = await model.generateContent(prompt);
  let rawText = result.response.text().trim();
  rawText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const suggestions = JSON.parse(rawText);
    return Array.isArray(suggestions) ? suggestions.filter((s) => VALID_KINDS.includes(s.kind)) : [];
  } catch {
    return [];
  }
}