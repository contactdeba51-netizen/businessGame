import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect:          false,
      transports:           ['websocket', 'polling'],  // fallback to polling if websocket fails
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      timeout:              20000,
    });

    socket.on('connect',        () => console.log('✅ Socket connected:', socket.id));
    socket.on('disconnect',     (r) => console.log('❌ Socket disconnected:', r));
    socket.on('reconnect',      (n) => console.log('🔁 Reconnected after', n, 'attempts'));
    socket.on('reconnect_failed', () => console.log('💀 Reconnection failed completely'));
    socket.on('connect_error',  (e) => console.log('🔴 Connect error:', e.message));
  }
  return socket;
};

export default getSocket;