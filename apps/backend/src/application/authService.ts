import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../infrastructure/database/prismaClient";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from "../infrastructure/auth/tokens";
import { AppError } from "../interfaces/http/middleware/errorHandler";
import { logAudit } from "../infrastructure/audit/auditLogger";

async function issueTokenPair(userId: string, email: string, family?: string) {
  const tokenFamily = family || crypto.randomUUID();
  const { raw, hash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      family: tokenFamily,
      expiresAt: refreshTokenExpiry(),
    },
  });

  const accessToken = signAccessToken({ id: userId, email });
  return { accessToken, refreshToken: raw, family: tokenFamily };
}

export async function register(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });

  return issueTokenPair(user.id, user.email);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new AppError(401, "Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid credentials");

  await logAudit({ action: "USER_LOGIN", userId: user.id, metadata: { method: "password" } });

  return issueTokenPair(user.id, user.email);
}

// This is the important part: rotation with reuse detection.
// Every refresh call invalidates the old token and issues a new one
// in the SAME family. If a token is presented that's already been
// revoked/replaced, it means either a stolen token was replayed, or
// a race condition occurred — either way we nuke the entire family
// (log the user out everywhere) rather than silently continuing.
export async function refresh(rawToken: string) {
  const hash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

  if (!record) throw new AppError(401, "Invalid refresh token");

  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: record.family },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, "Refresh token reuse detected — all sessions revoked");
  }

  if (record.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token expired");
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError(401, "User not found");

  const newPair = await issueTokenPair(user.id, user.email, record.family);

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedBy: newPair.refreshToken },
  });

  return newPair;
}

export async function logout(rawToken: string) {
  const hash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash },
    data: { revokedAt: new Date() },
  });
}

export async function findOrCreateOAuthUser(params: {
  provider: "google" | "github";
  providerId: string;
  email: string;
  name?: string;
}) {
  const field = params.provider === "google" ? "googleId" : "githubId";
  let user = await prisma.user.findFirst({ where: { [field]: params.providerId } });

  if (!user) {
    user = await prisma.user.findUnique({ where: { email: params.email } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { [field]: params.providerId },
      });
    } else {
      user = await prisma.user.create({
        data: { email: params.email, name: params.name, [field]: params.providerId },
      });
    }
  }
  await logAudit({
    action: "USER_LOGIN",
    userId: user.id,
    metadata: { method: params.provider },
  });
  return issueTokenPair(user.id, user.email);
}