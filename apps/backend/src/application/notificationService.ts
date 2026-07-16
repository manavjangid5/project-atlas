import { prisma } from "../infrastructure/database/prismaClient";
import { getIO } from "../infrastructure/realtime/socketServer";

interface CreateNotificationParams {
  organizationId: string;
  userId?: string; // omit to broadcast to whole org
  title: string;
  message: string;
  priority?: "low" | "normal" | "high";
}

export async function createNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title,
      message: params.message,
      priority: params.priority || "normal",
    },
  });

  const room = params.userId ? `user:${params.userId}` : `org:${params.organizationId}`;
  getIO().to(room).emit("notification", notification);

  return notification;
}

export async function listNotifications(organizationId: string, userId: string) {
  return prisma.notification.findMany({
    where: {
      organizationId,
      OR: [{ userId }, { userId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(organizationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { organizationId, OR: [{ userId }, { userId: null }], readAt: null },
    data: { readAt: new Date() },
  });
}