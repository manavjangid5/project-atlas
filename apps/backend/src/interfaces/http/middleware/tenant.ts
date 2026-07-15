import { Response, NextFunction } from "express";
import { prisma } from "../../../infrastructure/database/prismaClient";
import { AuthedRequest } from "./auth";
import { AppError } from "./errorHandler";

export interface TenantRequest extends AuthedRequest {
  tenant?: { organizationId: string; role: string };
}

// Reads organizationId from header (or query param as fallback) and
// verifies the authenticated user is actually a member — this is the
// single choke point that guarantees cross-tenant data leaks can't happen.
export async function requireTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
) {
  const organizationId =
    (req.headers["x-organization-id"] as string) || (req.query.organizationId as string);

  if (!organizationId) {
    throw new AppError(400, "Missing organization context (X-Organization-Id header)");
  }
  if (!req.user?.id) {
    throw new AppError(401, "Unauthorized");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: req.user.id, organizationId } },
  });

  if (!membership) {
    throw new AppError(403, "You are not a member of this organization");
  }

  req.tenant = { organizationId, role: membership.role };
  next();
}

export function requireTenantRole(...roles: string[]) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenant?.role || !roles.includes(req.tenant.role)) {
      throw new AppError(403, "Insufficient permissions for this action");
    }
    next();
  };
}