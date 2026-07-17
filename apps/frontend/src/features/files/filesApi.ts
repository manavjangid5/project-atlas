import { api } from "../../lib/api";

export interface FileAsset {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
}

export async function listFiles(): Promise<FileAsset[]> {
  const res = await api.get("/files");
  return res.data;
}

export async function uploadFile(file: File): Promise<FileAsset> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/files", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getDownloadUrl(id: string): Promise<string> {
  const res = await api.get(`/files/${id}/download-url`);
  return res.data.url;
}

export async function deleteFile(id: string) {
  await api.delete(`/files/${id}`);
}

export async function createShareLink(id: string, expiresInHours = 24): Promise<{ token: string; expiresAt: string }> {
  const res = await api.post(`/files/${id}/share`, { expiresInHours });
  return res.data;
}