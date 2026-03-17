import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/events' })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join:complaint')
  handleJoin(@MessageBody() complaintId: string, @ConnectedSocket() client: Socket) {
    client.join(`complaint:${complaintId}`);
  }

  emitNotificationRead(data: { notificationId: string; recipientId: string; readAt: Date }) {
    this.server.emit('notification:read', data);
  }

  emitEscalationTriggered(data: { complaintId: string; step: string; message: string }) {
    this.server.to(`complaint:${data.complaintId}`).emit('escalation:triggered', data);
  }

  emitPushNotification(data: { userId: string; title: string; body: string; complaintId: string }) {
    this.server.emit(`push:${data.userId}`, data);
  }
}
