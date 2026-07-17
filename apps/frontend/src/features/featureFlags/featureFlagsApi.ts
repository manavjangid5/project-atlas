import { api } from "../../lib/api";

export interface FeatureFlag {
  id: string;
  key: string;
  description?: string;
  isGloballyEnabled: boolean;
  rolloutPercentage: number;
}

export async function listFlags(): Promise<FeatureFlag[]> {
  const res = await api.get("/feature-flags");
  return res.data;
}

export async function createFlag(key: string, description: string): Promise<FeatureFlag> {
  const res = await api.post("/feature-flags", { key, description });
  return res.data;
}

export async function updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const res = await api.patch(`/feature-flags/${id}`, updates);
  return res.data;
}