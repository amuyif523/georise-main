import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (token: string) => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  const url = base.replace(/\/api$/, '');
  socket = io(url, {
    auth: { token },
    transports: ['websocket'],
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
