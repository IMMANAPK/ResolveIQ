import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { EscalationService } from './escalation.service';
import { EscalationSchedulerService } from './escalation-scheduler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { EscalationStep } from './entities/escalation-log.entity';

@Controller('escalation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EscalationController {
  constructor(
    private escalationService: EscalationService,
    private escalationScheduler: EscalationSchedulerService,
  ) {}

  @Get('history')
  @Roles(UserRole.ADMIN)
  getAllHistory() {
    return this.escalationService.getAllHistory();
  }

  @Get('complaint/:complaintId/history')
  getHistory(@Param('complaintId') complaintId: string) {
    return this.escalationService.getEscalationHistory(complaintId);
  }

  @Post('notification/:notificationId/trigger')
  @Roles(UserRole.ADMIN)
  triggerManual(
    @Param('notificationId') notificationId: string,
    @Body() body: { step: EscalationStep },
  ) {
    return this.escalationScheduler.triggerManualEscalation(notificationId, body.step);
  }
}
