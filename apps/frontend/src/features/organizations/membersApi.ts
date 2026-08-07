import { api } from "../../lib/api";

export interface Member {
  userId: string;
  role: string;
  user: { email: string; name?: string };
}

export async function listMembers(): Promise<Member[]> {
  const res = await api.get("/organizations/members");
  return res.data;
}

export async function inviteMember(organizationId: string, email: string, role: string) {
  const res = await api.post(`/organizations/${organizationId}/invitations`, { email, role });
  return res.data;
}

export async function updateMemberRole(organizationId: string, userId: string, role: string) {
  const res = await api.patch(`/organizations/${organizationId}/members/${userId}/role`, { role });
  return res.data;
}

export async function removeMember(userId: string) {
  await api.delete(`/organizations/members/${userId}`);
}