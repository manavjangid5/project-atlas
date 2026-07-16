import crypto from "crypto";
import { prisma } from "../infrastructure/database/prismaClient";
import { uploadToR2, getSignedDownloadUrl, deleteFromR2 } from "../infrastructure/storage/r2Client";
import { logAudit } from "../infrastructure/audit/auditLogger";
import { AppError } from "../interfaces/http/middleware/errorHandler";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "application/pdf", "text/plain", "application/json", "text/csv"];

export async function uploadFile(
  organizationId: string,
  userId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  existingFileId?: string // if provided, creates a new VERSION of that file
) {
  if (file.size > MAX_FILE_SIZE) throw new AppError(400, "File exceeds 20MB limit");
  if (!ALLOWED_TYPES.includes(file.mimetype)) throw new AppError(400, `File type ${file.mimetype} not allowed`);

  const storageKey = `${organizationId}/${crypto.randomUUID()}-${file.originalname}`;
  await uploadToR2(storageKey, file.buffer, file.mimetype);

  let version = 1;
  if (existingFileId) {
    const existing = await prisma.fileAsset.findFirst({ where: { id: existingFileId, organizationId } });
    if (existing) version = existing.version + 1;
  }

  const asset = await prisma.fileAsset.create({
    data: {
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey,
      version,
      organizationId,
      uploadedBy: userId,
    },
  });

  await logAudit({ action: "FILE_UPLOADED", organizationId, userId, metadata: { fileId: asset.id, fileName: file.originalname } });
  return asset;
}

export async function listFiles(organizationId: string) {
  return prisma.fileAsset.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDownloadUrl(organizationId: string, id: string) {
  const file = await prisma.fileAsset.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!file) throw new AppError(404, "File not found");
  return getSignedDownloadUrl(file.storageKey);
}

export async function softDeleteFile(organizationId: string, id: string) {
  const file = await prisma.fileAsset.findFirst({ where: { id, organizationId } });
  if (!file) throw new AppError(404, "File not found");
  return prisma.fileAsset.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function restoreFile(organizationId: string, id: string) {
  return prisma.fileAsset.update({ where: { id }, data: { deletedAt: null } });
}

export async function createShareLink(organizationId: string, fileId: string, expiresInHours = 24) {
  const file = await prisma.fileAsset.findFirst({ where: { id: fileId, organizationId } });
  if (!file) throw new AppError(404, "File not found");

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  return prisma.fileShareLink.create({ data: { fileId, token, expiresAt } });
}

export async function resolveShareLink(token: string) {
  const link = await prisma.fileShareLink.findUnique({ where: { token }, include: { file: true } });
  if (!link) throw new AppError(404, "Share link not found");
  if (link.expiresAt < new Date()) throw new AppError(410, "Share link expired");

  const url = await getSignedDownloadUrl(link.file.storageKey);
  return { url, fileName: link.file.fileName };
}