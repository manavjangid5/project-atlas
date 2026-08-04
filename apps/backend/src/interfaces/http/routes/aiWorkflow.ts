import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant, TenantRequest, requirePermission } from "../middleware/tenant";
import * as workflowService from "../../../application/workflowService";
import * as aiGenerator from "../../../application/aiWorkflowGeneratorService";
import { logAudit } from "../../../infrastructure/audit/auditLogger";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post("/workflows/generate", requireAuth, requireTenant, requirePermission("workflow", "create"), async (req: TenantRequest, res) => {
  const { instruction } = req.body;
  const { name, graph } = await aiGenerator.generateWorkflowFromPrompt(req.tenant!.organizationId, instruction);

  const workflow = await workflowService.createWorkflow(req.tenant!.organizationId, name);
  const updated = await workflowService.updateWorkflowGraph(req.tenant!.organizationId, workflow.id, graph);

  await logAudit({
    action: "WORKFLOW_AI_GENERATED",
    organizationId: req.tenant!.organizationId,
    metadata: { workflowId: workflow.id, instruction },
  });

  res.status(201).json(updated);
});

router.post("/workflows/:id/suggest-next", requireAuth, requireTenant, async (req: TenantRequest, res) => {
  const workflowId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const workflow = await workflowService.getWorkflow(req.tenant!.organizationId, workflowId);
  const suggestions = await aiGenerator.suggestNextNodes(workflow.graph as any, req.body.instruction);
  res.json(suggestions);
});

router.post("/ai/stream-test", requireAuth, requireTenant, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required" });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "AI is not configured" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;