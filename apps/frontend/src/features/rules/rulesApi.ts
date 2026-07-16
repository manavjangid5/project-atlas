import { api } from "../../lib/api";
import type { RuleModel, ConditionGroup, RuleAction } from "./ruleTypes";

export async function listRules(): Promise<RuleModel[]> {
  const res = await api.get("/rules");
  return res.data;
}

export async function createRule(name: string): Promise<RuleModel> {
  const res = await api.post("/rules", { name });
  return res.data;
}

export async function updateRule(
  id: string,
  updates: { conditions?: ConditionGroup; action?: RuleAction; isActive?: boolean }
): Promise<RuleModel> {
  const res = await api.patch(`/rules/${id}`, updates);
  return res.data;
}

export async function deleteRule(id: string) {
  await api.delete(`/rules/${id}`);
}

export async function evaluateRule(id: string, data: Record<string, any>) {
  const res = await api.post(`/rules/${id}/evaluate`, { data });
  return res.data;
}