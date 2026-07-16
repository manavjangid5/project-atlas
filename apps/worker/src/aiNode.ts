import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExecutionContext, NodeResult } from "./nodeExecutors";
import { getCached, setCached } from "./aiCache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Prompt abstraction layer: node config supplies a template with
// {variable} placeholders, resolved against the execution context
// before hitting the model. This is what lets the AI node stay
// provider-agnostic — swapping Gemini for another provider later
// only touches this file, not the graph executor or node schema.
function resolveTemplate(template: string, ctx: ExecutionContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return ctx.variables[key] !== undefined ? String(ctx.variables[key]) : `{${key}}`;
  });
}

const MAX_RETRIES = 2;

export async function executeAiPrompt(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  const prompt = resolveTemplate(config.prompt || "", ctx);

  if (!prompt.trim()) {
    return { status: "FAILED", error: "AI node has no prompt configured" };
  }

  const cached = getCached(prompt);
  if (cached) {
    return { status: "SUCCESS", output: { text: cached, cached: true } };
  }

  if (!process.env.GEMINI_API_KEY) {
    return fallbackResponse(prompt, "No Gemini API key configured");
  }

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      setCached(prompt, text);
      return { status: "SUCCESS", output: { text, cached: false } };
    } catch (err: any) {
      attempt++;
      console.error("Gemini call failed:", err?.message || err);
      const isRateLimited = err?.status === 429;
      const isTimeout = err?.code === "ETIMEDOUT";

      if (attempt >= MAX_RETRIES) {
        // Graceful fallback strategy — required by spec. Rather than
        // hard-failing the whole workflow run when the AI provider is
        // down, we return a soft "degraded" success so downstream
        // nodes can still proceed with a placeholder, and the run is
        // marked PARTIAL rather than FAILED.
        return fallbackResponse(prompt, `Gemini unavailable after retries: ${err.message}`, {
          isRateLimited,
          isTimeout,
        });
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return { status: "FAILED", error: "Unreachable" };
}

function fallbackResponse(prompt: string, reason: string, meta?: any): NodeResult {
  return {
    status: "SUCCESS",
    output: {
      text: `[AI unavailable — fallback] Could not generate a response for: "${prompt.slice(0, 80)}..."`,
      fallback: true,
      reason,
      meta,
    },
  };
}