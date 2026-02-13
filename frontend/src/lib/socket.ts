import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | null = null;

// Idempotent connect: re-use existing socket when token matches; otherwise re-create
export const connectSocket = (token: string) => {
  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  const url = base.replace(/\/api$/, '');

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  const socketOptions = {
    auth: { token },
    transports: ['polling', 'websocket'], // Start with polling to avoid connection issues
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  };

  socket = io(url, socketOptions);

  socket.on('connect_error', (err) => {
    console.error('Socket Connection Failed:', err.message);
  });

  return socket;
};

export const resetSocketGuard = () => {
  currentToken = null;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
};
