import { api } from "../../lib/api";
import type { Workflow, WorkflowGraph } from "./workflowTypes";

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await api.get("/workflows");
  return res.data;
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const res = await api.get(`/workflows/${id}`);
  return res.data;
}

export async function createWorkflow(name: string): Promise<Workflow> {
  const res = await api.post("/workflows", { name });
  return res.data;
}

export async function updateWorkflowGraph(id: string, graph: WorkflowGraph): Promise<Workflow> {
  const res = await api.patch(`/workflows/${id}`, { graph });
  return res.data;
}

export async function runWorkflow(id: string): Promise<{ runId: string }> {
  const res = await api.post(`/workflows/${id}/run`);
  return res.data;
}