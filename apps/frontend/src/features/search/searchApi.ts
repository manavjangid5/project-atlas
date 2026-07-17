import { api } from "../../lib/api";

export interface SearchResult {
  type: "workflow" | "form" | "rule" | "file" | "member";
  id: string;
  title: string;
  subtitle?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
  return res.data;
}