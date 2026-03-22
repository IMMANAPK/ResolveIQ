import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscalationLog, EscalationStep, EscalationStatus } from './entities/escalation-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationType, NotificationChannel, Notification } from '../notifications/entities/notification.entity';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectRepository(EscalationLog) private logRepo: Repository<EscalationLog>,
    private notificationsService: NotificationsService,
    private aiService: AiService,
    private emailService: EmailService,
    private usersService: UsersService,
    private eventsGateway: EventsGateway,
  ) {}

  async logEscalation(data: {
    complaintId: string;
    originalNotificationId: string;
    targetUserId: string;
    step: EscalationStep;
    metadata?: Record<string, unknown>;
    aiGeneratedSubject?: string;
    aiGeneratedBody?: string;
    status?: EscalationStatus;
  }): Promise<EscalationLog> {
    const log = this.logRepo.create({ ...data, status: data.status ?? EscalationStatus.TRIGGERED });
    return this.logRepo.save(log);
  }

  async sendSmartReminders(notification: Notification): Promise<void> {
    const unreadRecipients = await this.notificationsService.getUnreadRecipients(notification.id);
    const complaint = notification.complaint;

    for (const nr of unreadRecipients) {
      const hoursElapsed = Math.floor((Date.now() - notification.createdAt.getTime()) / 3_600_000);
      const tone = this.aiService.determineTone(complaint.priority, nr.reminderCount);

      const { subject, body } = await this.aiService.generateReminderEmail({
        recipientName: nr.recipient?.fullName ?? 'Team Member',
        complaintTitle: complaint.title,
        complaintDescription: complaint.description,
        priority: complaint.priority,
        tone,
        reminderCount: nr.reminderCount,
        hoursElapsed,
      });

      const html = this.emailService.buildNotificationHtml({
        recipientName: nr.recipient?.fullName ?? 'Team Member',
        complaintTitle: complaint.title,
        complaintId: complaint.id,
        trackingId: nr.trackingId,
        message: body,
        priority: complaint.priority,
      });

      const result = await this.emailService.sendEmail({
        to: nr.recipient?.email ?? '',
        subject,
        html,
      });

      if (result.success) {
        await this.notificationsService.incrementReminderCount(nr.id);
        await this.logEscalation({
          complaintId: complaint.id,
          originalNotificationId: notification.id,
          targetUserId: nr.recipientId,
          step: EscalationStep.REMINDER,
          metadata: { tone, hoursElapsed },
          aiGeneratedSubject: subject,
          aiGeneratedBody: body,
          status: EscalationStatus.COMPLETED,
        });
      }
    }
  }

  async rerouteToAvailableMembers(notification: Notification): Promise<void> {
    // Instead of re-routing to another committee, notify managers that the committee hasn't responded
    const managers = await this.usersService.getManagers();

    if (managers.length === 0) {
      this.logger.warn(`No managers found to escalate complaint ${notification.complaintId}`);
      return;
    }

    const complaint = notification.complaint;
    const subject = `[ACTION REQUIRED] Committee not responding: ${complaint?.title ?? 'Complaint'}`;

    for (const manager of managers) {
      if (!manager.email) continue;

      const html = this.emailService.buildNotificationHtml({
        recipientName: manager.fullName ?? 'Manager',
        complaintTitle: complaint?.title ?? 'Complaint',
        complaintId: notification.complaintId,
        trackingId: '',
        message: `The assigned committee has not responded to this complaint. Please take action.`,
        priority: complaint?.priority ?? 'medium',
      });

      await this.emailService.sendEmail({ to: manager.email, subject, html });

      await this.logEscalation({
        complaintId: notification.complaintId,
        originalNotificationId: notification.id,
        targetUserId: manager.id,
        step: EscalationStep.REROUTE,
        metadata: { escalatedToManager: true },
        status: EscalationStatus.COMPLETED,
      });
    }

    this.eventsGateway.emitEscalationTriggered({
      complaintId: notification.complaintId,
      step: 'reroute',
      message: `Manager notified — committee did not respond`,
    });
  }

  async triggerMultiChannelEscalation(notification: Notification): Promise<void> {
    const unreadRecipients = await this.notificationsService.getUnreadRecipients(notification.id);

    for (const nr of unreadRecipients) {
      this.eventsGateway.emitPushNotification({
        userId: nr.recipientId,
        title: `CRITICAL: Unviewed Complaint`,
        body: `Complaint "${notification.complaint?.title}" requires immediate attention`,
        complaintId: notification.complaintId,
      });

      await this.logEscalation({
        complaintId: notification.complaintId,
        originalNotificationId: notification.id,
        targetUserId: nr.recipientId,
        step: EscalationStep.MULTI_CHANNEL,
        metadata: { channel: 'push+in_app' },
        status: EscalationStatus.COMPLETED,
      });
    }

    this.eventsGateway.emitEscalationTriggered({
      complaintId: notification.complaintId,
      step: 'multi_channel',
      message: `Multi-channel escalation triggered for ${unreadRecipients.length} recipients`,
    });
  }

  async getEscalationHistory(complaintId: string): Promise<EscalationLog[]> {
    return this.logRepo.find({
      where: { complaintId },
      order: { createdAt: 'ASC' },
    });
  }
}
