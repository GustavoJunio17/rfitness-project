import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(accessToken: string): Socket {
  if (socket && socketToken === accessToken) return socket;

  socket?.disconnect();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  socket = io(baseUrl, { auth: { token: accessToken }, transports: ["websocket"] });
  socketToken = accessToken;
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
