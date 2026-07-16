import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:4000", {
      autoConnect: false,
    });
  }
  return socket;
}