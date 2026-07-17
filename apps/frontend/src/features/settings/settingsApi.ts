import { api } from "../../lib/api";

export async function updateOrgName(organizationId: string, name: string) {
  const res = await api.patch(`/organizations/${organizationId}`, { name });
  return res.data;
}