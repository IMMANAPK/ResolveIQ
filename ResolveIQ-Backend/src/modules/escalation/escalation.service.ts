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
    const unreadRecipients = await this.notificationsService.getUnreadRecipients(notification.id);
    const unreadIds = new Set(unreadRecipients.map((r) => r.recipientId));
    const availableMembers = await this.usersService.getAvailableCommitteeMembers();
    const rerouteTargets = availableMembers.filter((m) => !unreadIds.has(m.id));

    if (rerouteTargets.length === 0) {
      this.logger.warn(`No available alternates for complaint ${notification.complaintId}`);
      return;
    }

    const newNotification = await this.notificationsService.createNotification({
      complaintId: notification.complaintId,
      type: NotificationType.RE_ROUTED,
      channel: NotificationChannel.EMAIL,
      subject: `[RE-ROUTED] Action Required: ${notification.complaint?.title}`,
      body: `This complaint has been re-routed to you as the original assignees have not responded.`,
      recipientIds: rerouteTargets.map((m) => m.id),
    });

    for (const nr of newNotification.recipients) {
      const member = rerouteTargets.find((m) => m.id === nr.recipientId);
      const html = this.emailService.buildNotificationHtml({
        recipientName: member?.fullName ?? 'Team Member',
        complaintTitle: notification.complaint?.title ?? 'Complaint',
        complaintId: notification.complaintId,
        trackingId: nr.trackingId,
        message: `This complaint has been re-routed to you as previous assignees are unavailable.`,
        priority: notification.complaint?.priority ?? 'medium',
      });

      const result = await this.emailService.sendEmail({
        to: member?.email ?? '',
        subject: newNotification.subject,
        html,
      });

      if (result.success) {
        await this.notificationsService.markRecipientSent(nr.trackingId);
        await this.logEscalation({
          complaintId: notification.complaintId,
          originalNotificationId: notification.id,
          targetUserId: nr.recipientId,
          step: EscalationStep.REROUTE,
          metadata: { reroutedFrom: [...unreadIds] },
          status: EscalationStatus.COMPLETED,
        });
      }
    }

    this.eventsGateway.emitEscalationTriggered({
      complaintId: notification.complaintId,
      step: 'reroute',
      message: `Complaint re-routed to ${rerouteTargets.length} available members`,
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

  async getAllHistory(): Promise<EscalationLog[]> {
    return this.logRepo.find({
      relations: ['complaint', 'targetUser'],
      order: { createdAt: 'DESC' },
    });
  }
}
