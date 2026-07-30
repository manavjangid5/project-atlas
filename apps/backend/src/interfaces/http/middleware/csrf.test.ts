import request from "supertest";
import express from "express";
import { doubleCsrfProtection } from "./csrf";

describe("CSRF protection", () => {
  it("rejects a POST without a CSRF token", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test", doubleCsrfProtection, (req, res) => res.json({ ok: true }));
    const res = await request(app).post("/test").send({});
    expect(res.status).toBe(403);
  });
});