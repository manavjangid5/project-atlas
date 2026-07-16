import type { ExecutionContext, NodeResult } from "./nodeExecutors";

export async function executeAiPrompt(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  // Full Gemini integration with streaming + fallback comes next —
  // stubbed for now so the graph executor can be tested end-to-end.
  return { status: "SUCCESS", output: { note: "AI node placeholder — wiring next" } };
}