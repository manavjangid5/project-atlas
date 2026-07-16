import { api } from "../../lib/api";

export interface AuditLogEntry {
  id: string;
  action: string;
  metadata: Record<string, any>;
  createdAt: string;
  user?: { email: string; name?: string } | null;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pages: number;
}

export async function fetchAuditLogs(page = 1): Promise<AuditLogResponse> {
  const res = await api.get(`/audit-logs?page=${page}&limit=25`);
  return res.data;
}