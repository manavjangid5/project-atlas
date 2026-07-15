import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../../infrastructure/auth/tokens";

// Kept as a type alias so existing imports elsewhere (`AuthedRequest`)
// don't all need renaming — it's now just Request under the hood.
export type AuthedRequest = Request;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = verifyAccessToken(token) as any;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}