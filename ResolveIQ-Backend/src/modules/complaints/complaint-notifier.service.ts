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
  ) {}

  async notifyCommittee(complaint: Complaint): Promise<void> {
    let targetCommitteeName: string | null = null;
    let routingReason = '';

    const mappedCommittee = await this.committeesService.findByCategory(complaint.category);
    if (mappedCommittee) {
      targetCommitteeName = mappedCommittee.name;
      routingReason = `Category "${complaint.category}" is mapped to ${mappedCommittee.name}`;
      this.logger.log(`DB mapping: "${complaint.category}" → "${targetCommitteeName}"`);
    } else {
      const routing = await this.aiService.routeComplaint(complaint.title, complaint.description);
      targetCommitteeName = routing.committee;
      routingReason = routing.reason;
      this.logger.log(`Groq routed "${complaint.title}" → "${targetCommitteeName}" (${routing.confidence}). Reason: ${routingReason}`);
    }

    const allMembers = await this.usersService.getCommitteeMembers();
    let recipients = allMembers.filter(
      (u) => u.department?.toLowerCase() === targetCommitteeName!.toLowerCase(),
    );

    if (recipients.length === 0) {
      this.logger.warn(`No members found for "${targetCommitteeName}", falling back to all committee members`);
      recipients = allMembers;
    }

    const filerExcluded = recipients.filter((u) => u.id !== complaint.raisedById);
    if (filerExcluded.length < recipients.length) {
      this.logger.log(`Excluded complaint filer (id: ${complaint.raisedById}) from recipients`);
    }
    recipients = filerExcluded;

    if (recipients.length === 0) {
      this.logger.warn(`No recipients left after exclusions for complaint ${complaint.id}. Skipping.`);
      return;
    }

    const messagePrefix = `A new complaint has been submitted and assigned to the ${targetCommitteeName} for review.\n\nReason: ${routingReason}`;
    await this.sendNotificationToRecipients({
      complaint,
      recipients,
      type: NotificationType.INITIAL,
      messagePrefix,
    });

    try {
      await this.complaintRepo.update(complaint.id, { status: ComplaintStatus.ASSIGNED });
      this.logger.log(`Complaint ${complaint.id} status set to ASSIGNED`);
    } catch (err) {
      this.logger.error(`Failed to update complaint ${complaint.id} status`, err);
    }
  }

  async notifyManagers(complaint: Complaint): Promise<void> {
    let managers: User[] = [];

    const mappedCommittee = await this.committeesService.findByCategory(complaint.category);
    if (mappedCommittee?.manager) {
      managers = [mappedCommittee.manager];
      this.logger.log(`Escalating to committee manager: ${mappedCommittee.manager.email} (${mappedCommittee.name})`);
    } else {
      managers = await this.usersService.getManagers();
      this.logger.log(`No committee manager found for category "${complaint.category}", notifying all managers`);
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

      const result = await this.emailService.sendEmail({ to: member.email, subject, html });

      if (result.success) {
        await this.notificationsService.markRecipientSent(trackingId, result.messageId);
        this.logger.log(`Notification sent to ${member.email} (tracking: ${trackingId})`);
      } else {
        await this.notificationsService.markRecipientFailed(trackingId);
        this.logger.warn(`Failed to send to ${member.email}`);
      }
    }
  }
}
