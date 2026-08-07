import axios from "axios";
import { assertSafeUrl } from "./urlSafety";
import { executeAiPrompt } from "./aiNode";
export interface ExecutionContext {
  variables: Record<string, any>;
  organizationId?: string;
}

export interface NodeResult {
  status: "SUCCESS" | "FAILED";
  output?: any;
  error?: string;
}

function resolveTemplateValue(value: any, ctx: ExecutionContext): any {
  if (typeof value === "string") {
    return value.replace(/\{([\w-]+)\}/g, (_, key) => {
      const v = ctx.variables[key];
      if (v === undefined) return `{${key}}`;
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveTemplateValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k in value) out[k] = resolveTemplateValue(value[k], ctx);
    return out;
  }
  return value;
}

async function executeHttpRequest(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  try {
    const url = resolveTemplateValue(config.url, ctx);
    const body = resolveTemplateValue(config.body, ctx);
    const headers = resolveTemplateValue(config.headers, ctx);
    await assertSafeUrl(url);
    const res = await axios({ method: config.method || "GET", url, data: body, headers, timeout: config.timeoutMs || 10000 });
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
    await assertSafeUrl(webhookUrl);
    await axios.post(webhookUrl, { text: config.message || "Workflow notification" });
    return { status: "SUCCESS" };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}

async function executeWebhook(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  return executeHttpRequest({ ...config, method: config.method || "POST", body: resolveTemplateValue(config.body, ctx) }, ctx);
}

async function executeGithub(config: any): Promise<NodeResult> {
  try {
    const { owner, repo, action } = config;
    if (!owner || !repo) return { status: "FAILED", error: "GitHub node requires owner and repo" };

    const url =
      action === "latest_release"
        ? `https://api.github.com/repos/${owner}/${repo}/releases/latest`
        : `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`;

    await assertSafeUrl(url);
    const res = await axios.get(url, { headers: { "User-Agent": "project-atlas-workflow" } });
    return { status: "SUCCESS", output: res.data };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}

async function executeEmail(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "FAILED", error: "RESEND_API_KEY not configured" };
  try {
    const res = await axios.post(
      "https://api.resend.com/emails",
      {
        from: config.from || "workflows@resend.dev",
        to: resolveTemplateValue(config.to, ctx),
        subject: resolveTemplateValue(config.subject, ctx),
        text: resolveTemplateValue(config.body, ctx),
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    return { status: "SUCCESS", output: res.data };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}

async function executeSwitch(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  const value = resolveTemplateValue(config.field, ctx);
  const actual = ctx.variables[config.field] ?? value;
  const cases: { value: string; branch: string }[] = config.cases || [];
  const matched = cases.find((c) => String(actual) === c.value);
  return { status: "SUCCESS", output: { branch: matched?.branch || "default" } };
}

async function executeLoop(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  const items = ctx.variables[config.arrayVariable];
  if (!Array.isArray(items)) return { status: "FAILED", error: `${config.arrayVariable} is not an array` };
  const results = [];
  for (const item of items.slice(0, config.maxIterations || 20)) {
    const itemCtx: ExecutionContext = { variables: { ...ctx.variables, loop_item: item } };
    const result = await executeHttpRequest(config.action, itemCtx);
    results.push(result);
  }
  return { status: "SUCCESS", output: { iterations: results.length, results } };
}

async function executeDatabaseQuery(config: any, ctx: ExecutionContext): Promise<NodeResult> {
  const { prisma } = await import("@atlas/database");
  const ALLOWED_TABLES: Record<string, string> = {
    workflows: "workflow",
    forms: "formSchema",
    files: "fileAsset",
  };
  const table = ALLOWED_TABLES[config.table];
  if (!table) return { status: "FAILED", error: `Table "${config.table}" is not queryable` };
  try {
    const results = await (prisma as any)[table].findMany({
      where: { organizationId: ctx.organizationId },
      take: Number(config.limit) || 10,
    });
    return { status: "SUCCESS", output: results };
  } catch (err: any) {
    return { status: "FAILED", error: err.message };
  }
}
// AI node execution lives in aiNode.ts 

export async function executeNode(kind: string, config: any, ctx: ExecutionContext): Promise<NodeResult> {
  switch (kind) {
    case "http_request": return executeHttpRequest(config, ctx);
    case "delay": return executeDelay(config);
    case "conditional": return executeConditional(config, ctx);
    case "slack": return executeSlack(config);
    case "webhook": return executeWebhook(config,ctx);
    case "ai_prompt": return executeAiPrompt(config, ctx);
    case "github": return executeGithub(config);
    case "email": return executeEmail(config, ctx);
    case "switch": return executeSwitch(config, ctx);
    case "loop": return executeLoop(config, ctx);
    case "database_query": return executeDatabaseQuery(config, ctx);
    default: return { status: "FAILED", error: `Unknown node kind: ${kind}` };
  }
}