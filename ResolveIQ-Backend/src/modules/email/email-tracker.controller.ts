import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../gateway/events.gateway';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('email')
export class EmailTrackerController {
  constructor(
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {}

  @Get('track/:trackingId')
  async trackOpen(@Param('trackingId') trackingId: string, @Res() res: Response) {
    this.notificationsService
      .markRecipientAsRead(trackingId)
      .then((recipient) => {
        if (recipient) {
          this.eventsGateway.emitNotificationRead({
            notificationId: recipient.notificationId,
            recipientId: recipient.recipientId,
            readAt: recipient.readAt!,
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
