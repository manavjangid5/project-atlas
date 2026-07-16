import axios from "axios";

export interface ExecutionContext {
  variables: Record<string, any>;
}

export interface NodeResult {
  status: "SUCCESS" | "FAILED";
  output?: any;
  error?: string;
}

async function executeHttpRequest(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  try {
    const res = await axios({
      method: config.method || "GET",
      url: config.url,
      data: config.body,
      headers: config.headers,
      timeout: config.timeoutMs || 10000,
    });
    return { status: "SUCCESS", output: res.data };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}

async function executeDelay(config: any): Promise<NodeResult> {
  const ms = Math.min(config.durationMs || 1000, 30000); // hard cap to avoid runaway workers
  await new Promise((resolve) => setTimeout(resolve, ms));
  return { status: "SUCCESS", output: { waited: ms } };
}

async function executeConditional(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  try {
    const { field, operator, value } = config;
    const actual = ctx.variables[field];
    let result = false;
    switch (operator) {
      case "equals": result = actual === value; break;
      case "notEquals": result = actual !== value; break;
      case "greaterThan": result = actual > value; break;
      case "lessThan": result = actual < value; break;
      case "contains": result = String(actual).includes(value); break;
      default: result = false;
    }
    return { status: "SUCCESS", output: { branch: result ? "true" : "false" } };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}

async function executeSlack(config: any): Promise<NodeResult> {
  const webhookUrl = config.webhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return { status: "FAILED", error: "No Slack webhook configured" };
  try {
    await axios.post(webhookUrl, { text: config.message || "Workflow notification" });
    return { status: "SUCCESS" };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}

async function executeWebhook(config: any): Promise<NodeResult> {
  return executeHttpRequest({ ...config, method: config.method || "POST" }, { variables: {} });
}

// AI node execution lives in aiNode.ts — kept separate since it has
// its own streaming/fallback/caching concerns (see next message).
import { executeAiPrompt } from "./aiNode";

export async function executeNode(kind: string, config: any, ctx: ExecutionContext): Promise<NodeResult> {
  switch (kind) {
    case "http_request": return executeHttpRequest(config, ctx);
    case "delay": return executeDelay(config);
    case "conditional": return executeConditional(config, ctx);
    case "slack": return executeSlack(config);
    case "webhook": return executeWebhook(config);
    case "ai_prompt": return executeAiPrompt(config, ctx);
    default: return { status: "FAILED", error: `Unknown node kind: ${kind}` };
  }
}