import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';

export const socket = io(`${SOCKET_URL}/events`, {
  autoConnect: false,
  transports: ['websocket'],
});
