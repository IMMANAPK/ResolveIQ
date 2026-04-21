import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const PRIVILEGED_ROLES = ['admin', 'manager', 'committee_member'];

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Admin / manager / committee_member → all notifications
   * Complainant                        → only notifications where they are a recipient
   */
  @Get()
  findAll(@CurrentUser() user: { id: string; roles?: string[] }) {
    const roles: string[] = user.roles ?? [];
    const isPrivileged = roles.some((r) => PRIVILEGED_ROLES.includes(r));
    if (isPrivileged) {
      return this.notificationsService.findAll();
    }
    return this.notificationsService.findForUser(user.id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.notificationsService.getNotificationStatus(id);
  }

  @Get('complaint/:complaintId')
  getForComplaint(@Param('complaintId') complaintId: string) {
    return this.notificationsService.getNotificationsForComplaint(complaintId);
  }

  @Patch('complaint/:complaintId/mark-reviewed')
  markReviewed(
    @Param('complaintId') complaintId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.markReviewedByComplaintAndUser(complaintId, user.id);
  }
}
