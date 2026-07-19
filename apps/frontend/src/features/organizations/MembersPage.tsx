import { useEffect, useState } from "react";
import {
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from "./membersApi";
import type { Member } from "./membersApi";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/Button";

const ROLES = ["ADMIN", "DEVELOPER", "VIEWER"];

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("DEVELOPER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const currentOrg = useAuthStore((s) => s.getActiveOrg());
  const canManage =
    currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";

  function refresh() {
    listMembers().then(setMembers);
  }

  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  useEffect(refresh, [activeOrgId]);

  async function handleInvite() {
    if (!inviteEmail.trim() || !activeOrgId) return;
    try {
      const invite = await inviteMember(
        activeOrgId,
        inviteEmail.trim(),
        inviteRole,
      );
      setInviteLink(
        `${window.location.origin}/invitations/${invite.token}/accept`,
      );
      setInviteEmail("");
    } catch (err: any) {
      alert(
        err?.response?.data?.error ||
          "Could not create invite. Check your role and try again.",
      );
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    await updateMemberRole(userId, role);
    refresh();
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    await removeMember(userId);
    refresh();
  }

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-xl font-bold mb-6">Members</h2>

      {canManage && (
        <div className="flex gap-2 mb-4">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email to invite"
            className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-surface border border-border rounded-sm px-2 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button onClick={handleInvite}>Invite</Button>
        </div>
      )}

      {inviteLink && (
        <div className="bg-accent/10 border border-accent/30 rounded-md p-3 mb-6 text-xs">
          <p className="text-muted mb-1">
            Share this invite link (no email service configured yet):
          </p>
          <code className="break-all">{inviteLink}</code>
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center gap-3 bg-surface border border-border rounded-md px-4 py-3"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">
                {m.user.name || m.user.email}
              </p>
              <p className="text-xs text-muted">{m.user.email}</p>
            </div>
            {canManage && m.role !== "OWNER" ? (
              <select
                value={m.role}
                onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                className="bg-bg border border-border rounded-sm text-xs px-2 py-1"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted">{m.role}</span>
            )}
            {canManage && m.role !== "OWNER" && (
              <button
                onClick={() => handleRemove(m.userId)}
                className="text-xs text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
