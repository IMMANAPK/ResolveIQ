import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { CommitteesService } from '../committees/committees.service';
import { Complaint, ComplaintStatus } from './entities/complaint.entity';
import { NotificationType, NotificationChannel } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { AiService } from '../ai/ai.service';
import { AttachmentsService } from '../attachments/attachments.service';

@Injectable()
export class ComplaintNotifierService {
  private readonly logger = new Logger(ComplaintNotifierService.name);

  constructor(
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private usersService: UsersService,
    private aiService: AiService,
    private committeesService: CommitteesService,
    @InjectRepository(Complaint) private complaintRepo: Repository<Complaint>,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async notifyCommittee(complaint: Complaint): Promise<void> {
    this.logger.log(`notifyCommittee called for ${complaint.id} - legacy routing handled by Phase 2 routing queue`);
  }

  async notifyManagers(complaint: Complaint): Promise<void> {
    let managers: User[] = [];

    if (complaint.committeeId) {
      const mappedCommittee = await this.committeesService.findById(complaint.committeeId);
      if (mappedCommittee?.manager) {
        managers = [mappedCommittee.manager];
        this.logger.log(`Escalating to committee manager: ${mappedCommittee.manager.email} (${mappedCommittee.name})`);
      }
    } else {
      managers = await this.usersService.getManagers();
      this.logger.log(`No committee manager found for complaint "${complaint.id}", notifying all managers`);
    }

    if (managers.length === 0) {
      this.logger.warn(`No managers found for complaint ${complaint.id}`);
      return;
    }

    await this.sendNotificationToRecipients({
      complaint,
      recipients: managers,
      type: NotificationType.ESCALATION,
      messagePrefix: 'This complaint has been escalated to management level.',
    });
  }

  async sendToRecipientIds(opts: {
    complaint: Complaint;
    recipientUserIds: string[];
    includeAiSummary: boolean;
  }): Promise<void> {
    const { complaint, recipientUserIds, includeAiSummary } = opts;
    const recipients = await this.usersService.findByIds(recipientUserIds);
    if (!recipients.length) return;

    let messagePrefix = `A new complaint has been routed for your review.`;
    if (includeAiSummary && complaint.aiSummary) {
      messagePrefix += `\n\nAI Summary:\n${complaint.aiSummary}`;
    }

    await this.sendNotificationToRecipients({
      complaint,
      recipients,
      type: NotificationType.INITIAL,
      messagePrefix,
    });
  }

  private async sendNotificationToRecipients(opts: {
    complaint: Complaint;
    recipients: User[];
    type: NotificationType;
    messagePrefix: string;
  }): Promise<void> {
    const { complaint, recipients, type, messagePrefix } = opts;
    const subject = `[${complaint.priority.toUpperCase()}] Complaint: ${complaint.title}`;

    const notification = await this.notificationsService.createNotification({
      complaintId: complaint.id,
      type,
      channel: NotificationChannel.EMAIL,
      subject,
      body: messagePrefix,
      recipientIds: recipients.map((r) => r.id),
    });

    const trackingMap = new Map(notification.recipients.map((nr) => [nr.recipientId, nr.trackingId]));

    for (const member of recipients) {
      const trackingId = trackingMap.get(member.id);
      if (!trackingId) continue;

      const html = this.emailService.buildNotificationHtml({
        recipientName: member.fullName,
        complaintTitle: complaint.title,
        complaintId: complaint.id,
        trackingId,
        message: messagePrefix,
        priority: complaint.priority,
      });

      const attachmentsHtml = await this.buildAttachmentsHtml(opts.complaint.id);
      const fullHtml = html + attachmentsHtml;

      const result = await this.emailService.sendEmail({ to: member.email, subject, html: fullHtml });

      if (result.success) {
        await this.notificationsService.markRecipientSent(trackingId, result.messageId);
        this.logger.log(`Notification sent to ${member.email} (tracking: ${trackingId})`);
      } else {
        await this.notificationsService.markRecipientFailed(trackingId);
        this.logger.warn(`Failed to send to ${member.email}`);
      }
    }
  }

  private async buildAttachmentsHtml(complaintId: string): Promise<string> {
    const attachments = await this.attachmentsService.findByComplaint(complaintId);
    if (!attachments.length) return '';

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const parts = attachments.map((a) => {
      if (a.mimetype.startsWith('image/')) {
        return `<div style="margin:4px 0"><img src="${a.url}" alt="${esc(a.filename)}" style="max-width:400px;border-radius:4px" /></div>`;
      }
      return `<div style="margin:4px 0">\uD83D\uDCCE <a href="${a.url}">${esc(a.filename)}</a></div>`;
    });

    return `<div style="margin-top:12px"><strong>Attachments:</strong>${parts.join('')}</div>`;
  }
}
