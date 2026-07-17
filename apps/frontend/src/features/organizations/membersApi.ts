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

export async function inviteMember(email: string, role: string) {
  const res = await api.post("/organizations/invitations", { email, role });
  return res.data;
}

export async function updateMemberRole(userId: string, role: string) {
  const res = await api.patch(`/organizations/members/${userId}/role`, { role });
  return res.data;
}

export async function removeMember(userId: string) {
  await api.delete(`/organizations/members/${userId}`);
}