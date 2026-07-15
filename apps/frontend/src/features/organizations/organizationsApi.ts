import { api } from "../../lib/api";

export interface Organization {
  id: string;
  name: string;
  role: string;
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await api.get("/organizations");
  return res.data;
}

export async function createOrganization(name: string): Promise<Organization> {
  const res = await api.post("/organizations", { name });
  return res.data;
}