import { Controller, Get, Param, Res, Inject, forwardRef } from '@nestjs/common';
import { Response } from 'express';

// 1x1 transparent GIF bytes
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// Placeholder interfaces — will be replaced with real services in Task 8/9
export interface INotificationsService {
  markRecipientAsRead(trackingId: string): Promise<{ notificationId: string; recipientId: string; readAt: Date } | null>;
}

export interface IEventsGateway {
  emitNotificationRead(data: { notificationId: string; recipientId: string; readAt: Date }): void;
}

export const NOTIFICATIONS_SERVICE_TOKEN = 'NOTIFICATIONS_SERVICE';
export const EVENTS_GATEWAY_TOKEN = 'EVENTS_GATEWAY';

@Controller('email')
export class EmailTrackerController {
  constructor(
    @Inject(NOTIFICATIONS_SERVICE_TOKEN) private notificationsService: INotificationsService,
    @Inject(EVENTS_GATEWAY_TOKEN) private eventsGateway: IEventsGateway,
  ) {}

  @Get('track/:trackingId')
  async trackOpen(@Param('trackingId') trackingId: string, @Res() res: Response) {
    // Mark as read and emit real-time event (fire-and-forget)
    this.notificationsService
      .markRecipientAsRead(trackingId)
      .then((recipient) => {
        if (recipient) {
          this.eventsGateway.emitNotificationRead({
            notificationId: recipient.notificationId,
            recipientId: recipient.recipientId,
            readAt: recipient.readAt,
          });
        }
      })
      .catch(() => {});

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.end(TRANSPARENT_GIF);
  }
}
