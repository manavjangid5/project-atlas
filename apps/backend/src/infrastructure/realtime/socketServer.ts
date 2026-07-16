import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../auth/tokens";

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
    // Read the httpOnly accessToken cookie directly from the raw
    // handshake headers — the browser attaches it automatically
    // (same as any XHR/fetch call), so no client-side token handling
    // is needed or even possible, matching how our REST auth works.
    const cookieHeader = socket.handshake.headers.cookie;
    const token = parseCookie(cookieHeader, "accessToken");

    try {
      const payload = token ? verifyAccessToken(token) : null;
      if (!payload) throw new Error("No valid token");

      socket.data.userId = payload.id;
      socket.emit("authenticated", { ok: true });

      socket.on("join-org", (organizationId: string) => {
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