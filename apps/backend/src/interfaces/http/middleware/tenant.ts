import { Request, Response, NextFunction } from "express";
import { prisma } from "../../../infrastructure/database/prismaClient";
import { AppError } from "./errorHandler";

export type TenantRequest = Request;

export async function requireTenant(req: Request, res: Response, next: NextFunction) {
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
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant?.role || !roles.includes(req.tenant.role)) {
      throw new AppError(403, "Insufficient permissions for this action");
    }
    next();
  };
}