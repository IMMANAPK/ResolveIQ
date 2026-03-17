import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/events', {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
