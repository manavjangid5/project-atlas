import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err?.code === "EBADCSRFTOKEN" || err?.message?.toLowerCase().includes("csrf")) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}