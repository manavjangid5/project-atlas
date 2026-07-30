import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../auth/tokens";
import { prisma } from "../database/prismaClient";

let io: SocketIOServer | null = null;

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    
    const cookieHeader = socket.handshake.headers.cookie;
    const token = parseCookie(cookieHeader, "accessToken");

    try {
      const payload = token ? verifyAccessToken(token) : null;
      if (!payload) throw new Error("No valid token");

      socket.data.userId = payload.id;
      socket.emit("authenticated", { ok: true });
      
      socket.on("join-org", async (organizationId: string) => {
        const membership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: payload.id,
              organizationId,
            },
          },
        });

        if (!membership) {
          socket.emit("join-org-denied", { organizationId });
          return;
        }

        socket.join(`org:${organizationId}`);
        socket.join(`user:${payload.id}`);
      });

    } catch {
      socket.emit("authenticated", { ok: false });
    }
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}