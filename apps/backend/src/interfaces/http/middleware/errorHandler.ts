import { Request, Response, NextFunction } from "express";
import { DomainError } from "../../../domain/errors";
export class AppError extends DomainError {}


export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err?.code === "EBADCSRFTOKEN" || err?.message?.toLowerCase().includes("csrf")) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}