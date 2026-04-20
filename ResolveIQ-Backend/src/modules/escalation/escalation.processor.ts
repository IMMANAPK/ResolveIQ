import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EscalationService } from './escalation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscalationStep } from './entities/escalation-log.entity';

export const ESCALATION_QUEUE = 'escalation';

export interface EscalationJobData {
  notificationId: string;
  step: EscalationStep;
}

@Processor(ESCALATION_QUEUE)
export class EscalationProcessor {
  private readonly logger = new Logger(EscalationProcessor.name);

  constructor(
    private escalationService: EscalationService,
    private notificationsService: NotificationsService,
  ) {}

  @Process('process-escalation')
  async handleEscalation(job: Job<EscalationJobData>) {
    const { notificationId, step } = job.data;
    this.logger.log(`Processing escalation step=${step} for notification=${notificationId}`);

    const notification = await this.notificationsService.findById(notificationId);
    if (!notification || notification.allRead) {
      this.logger.log(`Notification ${notificationId} already acknowledged, skipping`);
      return;
    }

    switch (step) {
      case EscalationStep.REMINDER:
        await this.escalationService.sendSmartReminders(notification);
        break;
      case EscalationStep.REROUTE:
        await this.escalationService.rerouteToAvailableMembers(notification);
        break;
      case EscalationStep.MULTI_CHANNEL:
        await this.escalationService.triggerMultiChannelEscalation(notification);
        break;
    }
  }
}
