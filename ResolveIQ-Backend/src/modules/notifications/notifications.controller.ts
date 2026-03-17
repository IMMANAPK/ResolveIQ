import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.notificationsService.getNotificationStatus(id);
  }

  @Get('complaint/:complaintId')
  getForComplaint(@Param('complaintId') complaintId: string) {
    return this.notificationsService.getNotificationsForComplaint(complaintId);
  }
}
