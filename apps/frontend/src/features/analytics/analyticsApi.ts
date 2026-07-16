import { api } from "../../lib/api";

export interface Overview {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  partialRuns: number;
  successRate: number;
  totalWorkflows: number;
  totalMembers: number;
  avgDurationSeconds: number;
}

export async function fetchOverview(): Promise<Overview> {
  const res = await api.get("/analytics/overview");
  return res.data;
}

export async function fetchNodeUsage() {
  const res = await api.get("/analytics/node-usage");
  return res.data as { kind: string; count: number }[];
}

export async function fetchDailyExecutions() {
  const res = await api.get("/analytics/daily-executions");
  return res.data as { date: string; count: number }[];
}

export async function fetchActiveUsers() {
  const res = await api.get("/analytics/active-users");
  return res.data as { user?: { email: string; name?: string }; actionCount: number }[];
}