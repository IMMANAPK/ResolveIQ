import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificationsService } from '../notifications/notifications.service';

export const EMAIL_QUEUE = 'email';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  trackingId: string;
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJobData>) {
    const { to, subject, html, trackingId } = job.data;
    const result = await this.emailService.sendEmail({ to, subject, html });
    if (!result.success) {
      throw new Error(`Failed to send email to ${to}`);
    }
    await this.notificationsService.markRecipientSent(trackingId, result.messageId);
    this.logger.log(`Email sent to ${to} (tracking: ${trackingId})`);
  }

  @OnQueueFailed()
  async onFailed(job: Job<EmailJobData>) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.notificationsService.markRecipientFailed(job.data.trackingId);
      this.logger.error(`Email permanently failed to ${job.data.to} after ${job.attemptsMade} attempts`);
    }
  }
}
