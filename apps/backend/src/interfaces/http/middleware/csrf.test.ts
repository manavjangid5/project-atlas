import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { doubleCsrfProtection } from "./csrf";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post("/test", doubleCsrfProtection, (req, res) => res.json({ ok: true }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err?.code === "EBADCSRFTOKEN" || err?.message?.toLowerCase().includes("csrf")) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    next(err);
  });
  return app;
}

describe("CSRF protection", () => {
  it("rejects a POST without a CSRF token", async () => {
    const res = await request(buildApp()).post("/test").send({});
    expect(res.status).toBe(403);
  });
});