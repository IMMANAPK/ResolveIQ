import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { ESCALATION_QUEUE } from './escalation.processor';
import { EscalationStep } from './entities/escalation-log.entity';

@Injectable()
export class EscalationSchedulerService {
  private readonly logger = new Logger(EscalationSchedulerService.name);

  private readonly reminderMinutes = parseInt(process.env.ESCALATION_REMINDER_MINUTES ?? '60', 10);
  private readonly rerouteMinutes = parseInt(process.env.ESCALATION_REROUTE_MINUTES ?? '180', 10);
  private readonly criticalMinutes = parseInt(process.env.ESCALATION_CRITICAL_MINUTES ?? '360', 10);

  constructor(
    @InjectQueue(ESCALATION_QUEUE) private escalationQueue: Queue,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runEscalationCheck() {
    this.logger.log('Running escalation check...');
    const notifications = await this.notificationsService.getUnacknowledgedNotifications(
      this.reminderMinutes,
    );

    for (const notification of notifications) {
      const ageMinutes = (Date.now() - notification.createdAt.getTime()) / 60_000;
      let step: EscalationStep;

      if (ageMinutes >= this.criticalMinutes) {
        step = EscalationStep.MULTI_CHANNEL;
      } else if (ageMinutes >= this.rerouteMinutes) {
        step = EscalationStep.REROUTE;
      } else {
        step = EscalationStep.REMINDER;
      }

      await this.escalationQueue.add(
        'process-escalation',
        { notificationId: notification.id, step },
        { attempts: 3, backoff: 5000, removeOnComplete: true },
      );
    }
  }

  async triggerManualEscalation(notificationId: string, step: EscalationStep): Promise<void> {
    await this.escalationQueue.add(
      'process-escalation',
      { notificationId, step },
      { attempts: 3, backoff: 5000 },
    );
  }
}
