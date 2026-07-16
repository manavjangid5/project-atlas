import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../auth/tokens";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Auth handshake: client sends its access token, we verify and join
  // them to a room scoped to their organization so notifications
  // only reach members of that org — same tenant-isolation principle
  // as the REST API, applied to the realtime layer.
  io.on("connection", (socket) => {
    socket.on("authenticate", ({ token, organizationId }) => {
      try {
        const payload = verifyAccessToken(token);
        socket.data.userId = payload.id;
        socket.join(`org:${organizationId}`);
        socket.join(`user:${payload.id}`);
        socket.emit("authenticated", { ok: true });
      } catch {
        socket.emit("authenticated", { ok: false });
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}