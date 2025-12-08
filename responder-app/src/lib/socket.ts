import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (token: string) => {
  socket = io(import.meta.env.VITE_WS_URL || "http://localhost:4000", {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
