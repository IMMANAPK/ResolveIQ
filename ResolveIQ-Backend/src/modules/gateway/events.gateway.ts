import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3001'];

@WebSocketGateway({
  cors: { origin: allowedOrigins, credentials: true },
  namespace: '/events',
})
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join:complaint')
  handleJoin(@MessageBody() complaintId: string, @ConnectedSocket() client: Socket) {
    client.join(`complaint:${complaintId}`);
  }

  emitComplaintUpdated(data: { complaintId: string; status: string }) {
    this.server.to(`complaint:${data.complaintId}`).emit('complaint:updated', data);
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

  emitSummaryUpdated(complaintId: string) {
    this.server.to(`complaint:${complaintId}`).emit('complaint.summary.updated', { complaintId });
  }
}
