import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;

export interface AccessTokenPayload {
  id: string;
  email: string;
  orgId?: string;
  role?: string;
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload;
}

// Refresh tokens are opaque random strings, NOT JWTs.
// We only ever store their SHA-256 hash in the DB — the raw value
// exists only in the client's cookie. This means a DB leak alone
// can't be used to forge sessions.
export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshTokenExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
}