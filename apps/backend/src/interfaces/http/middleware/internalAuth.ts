import { Request, Response, NextFunction } from "express";

export function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.INTERNAL_SERVICE_SECRET) {
    return res.status(401).json({ error: "Invalid internal service credentials" });
  }
  next();
}