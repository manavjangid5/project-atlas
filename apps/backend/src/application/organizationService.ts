import crypto from "crypto";
import { prisma } from "../infrastructure/database/prismaClient";
import { AppError } from "../interfaces/http/middleware/errorHandler";

export async function createOrganization(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name } });
    await tx.membership.create({
      data: { userId, organizationId: org.id, role: "OWNER" },
    });
    return org;
  });
}

export async function listUserOrganizations(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
  });
  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
  }));
}

export async function inviteMember(
  organizationId: string,
  invitedBy: string,
  email: string,
  role: "ADMIN" | "DEVELOPER" | "VIEWER"
) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return prisma.invitation.create({
    data: { organizationId, invitedBy, email, role, token, expiresAt },
  });
  // Email delivery is intentionally out of scope for now — logged to
  // console in dev; documented as a TODO with SES/Resend as the
  // production path in TRADEOFFS.md.
}

export async function acceptInvitation(token: string, userId: string) {
  const invite = await prisma.invitation.findUnique({ where: { token } });
  if (!invite) throw new AppError(404, "Invitation not found");
  if (invite.acceptedAt) throw new AppError(410, "Invitation already used");
  if (invite.expiresAt < new Date()) throw new AppError(410, "Invitation expired");

  return prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        userId_organizationId: { userId, organizationId: invite.organizationId },
      },
      update: { role: invite.role },
      create: { userId, organizationId: invite.organizationId, role: invite.role },
    });
    return tx.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });
}

export async function updateMemberRole(
  organizationId: string,
  targetUserId: string,
  newRole: "ADMIN" | "DEVELOPER" | "VIEWER" | "OWNER"
) {
  return prisma.membership.update({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
    data: { role: newRole },
  });
}

export async function removeMember(organizationId: string, targetUserId: string) {
  return prisma.membership.delete({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
}