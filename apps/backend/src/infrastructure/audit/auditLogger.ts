import { prisma } from "../database/prismaClient";

interface AuditEntry {
  action: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

// Fire-and-forget by design: audit logging should never block or
// fail the actual request. If the DB write fails, we log to console
// rather than throwing — losing an audit entry is bad, but crashing
// a user's real action because of it would be worse.
export async function logAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId,
        organizationId: entry.organizationId,
        metadata: entry.metadata as any,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}