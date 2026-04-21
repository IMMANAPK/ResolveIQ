import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { ESCALATION_QUEUE } from './escalation.processor';
import { EscalationStep } from './entities/escalation-log.entity';

const AI_DECISION_STEP_MAP: Record<string, EscalationStep> = {
  reminder: EscalationStep.REMINDER,
  reroute: EscalationStep.REROUTE,
  multi_channel: EscalationStep.MULTI_CHANNEL,
};

@Injectable()
export class EscalationSchedulerService {
  private readonly logger = new Logger(EscalationSchedulerService.name);

  private readonly reminderMinutes = parseInt(process.env.ESCALATION_REMINDER_MINUTES ?? '60', 10);
  private readonly rerouteMinutes = parseInt(process.env.ESCALATION_REROUTE_MINUTES ?? '180', 10);
  private readonly criticalMinutes = parseInt(process.env.ESCALATION_CRITICAL_MINUTES ?? '360', 10);
  private readonly batchSize = parseInt(process.env.ESCALATION_BATCH_SIZE ?? '50', 10);

  constructor(
    @InjectQueue(ESCALATION_QUEUE) private escalationQueue: Queue,
    private notificationsService: NotificationsService,
    private aiService: AiService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runEscalationCheck() {
    this.logger.log('Running AI-driven escalation check...');
    const notifications = await this.notificationsService.getUnacknowledgedNotifications(
      this.reminderMinutes,
      this.batchSize,
    );

    for (const notification of notifications) {
      const ageMinutes = (Date.now() - notification.createdAt.getTime()) / 60_000;
      const complaint = notification.complaint;

      if (!complaint) {
        this.logger.warn(`Notification ${notification.id} has no linked complaint, skipping`);
        continue;
      }

      // Count how many reminders have already been sent across all recipients
      const maxReminderCount = notification.recipients?.reduce(
        (max, r) => Math.max(max, r.reminderCount ?? 0),
        0,
      ) ?? 0;

      const decision = await this.aiService.decideEscalationAction({
        complaintTitle: complaint.title,
        complaintDescription: complaint.description ?? '',
        priority: complaint.priority ?? 'medium',
        ageMinutes,
        reminderCount: maxReminderCount,
      });

      this.logger.log(
        `Notification ${notification.id} — AI decision: ${decision.step} (${decision.reason})`,
      );

      if (!decision.shouldEscalate || decision.step === 'skip') {
        continue;
      }

      const step = AI_DECISION_STEP_MAP[decision.step] ?? EscalationStep.REMINDER;

      await this.escalationQueue.add(
        'process-escalation',
        { notificationId: notification.id, step, aiReason: decision.reason },
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
