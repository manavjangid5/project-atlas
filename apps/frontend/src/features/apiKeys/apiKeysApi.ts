import { api } from "../../lib/api";

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await api.get("/api-keys");
  return res.data;
}

export async function createApiKey(name: string): Promise<{ rawKey: string; keyPrefix: string }> {
  const res = await api.post("/api-keys", { name });
  return res.data;
}

export async function revokeApiKey(id: string) {
  await api.delete(`/api-keys/${id}`);
}

export async function getUsageStats(): Promise<{ totalRequests: number; requestsLast24h: number }> {
  const res = await api.get("/api-keys/usage");
  return res.data;
}