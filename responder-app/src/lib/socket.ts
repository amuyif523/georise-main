import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let activeIncidentId: number | null = null;

const joinActiveIncidentRoom = () => {
  if (socket && socket.connected && activeIncidentId !== null) {
    socket.emit('join_incident', activeIncidentId);
  }
};

export const connectSocket = (token: string) => {
  const url = import.meta.env.VITE_WS_URL || 'http://localhost:4000';
  socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    withCredentials: true,
    reconnectionAttempts: 5,
    autoConnect: false,
  });

  socket.connect();

  socket.on('connect_error', (err) => {
    console.error('Responder Socket Error:', err.message);
  });

  // Rejoin mission room both on initial connect and reconnect after drops.
  socket.on('connect', () => {
    joinActiveIncidentRoom();
  });
  socket.on('reconnect', () => {
    if (activeIncidentId !== null) {
      joinActiveIncidentRoom();
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const setActiveIncidentRoom = (incidentId: number | null) => {
  const previousIncidentId = activeIncidentId;
  activeIncidentId = incidentId;

  if (!socket || !socket.connected) return;

  if (previousIncidentId && previousIncidentId !== incidentId) {
    socket.emit('leave_incident', previousIncidentId);
  }

  joinActiveIncidentRoom();
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeIncidentId = null;
};
