import { Controller, Get, Param, Res, Logger, Query } from '@nestjs/common';
import type { Response } from 'express';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../gateway/events.gateway';
import { ConfigService } from '@nestjs/config';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('email')
export class EmailTrackerController {
  private readonly logger = new Logger(EmailTrackerController.name);

  constructor(
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
    private configService: ConfigService,
  ) {}

  @Get('track/:trackingId')
  async trackOpen(@Param('trackingId') trackingId: string, @Res() res: Response) {
    this.logger.log(`Received tracking pixel request for ID: ${trackingId}`);
    
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

  @Get('view/:trackingId')
  async trackClick(
    @Param('trackingId') trackingId: string,
    @Query('complaintId') complaintId: string,
    @Res() res: Response,
  ) {
    this.logger.log(`User clicked email link for tracking ID: ${trackingId}`);
    
    try {
      const recipient = await this.notificationsService.markRecipientAsRead(trackingId);
      if (recipient) {
        this.eventsGateway.emitNotificationRead({
          notificationId: recipient.notificationId,
          recipientId: recipient.recipientId,
          readAt: recipient.readAt!,
        });
      }
    } catch (err) {
      this.logger.error(`Error marking click as read: ${err.message}`);
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/complaints/${complaintId}`);
  }
}
