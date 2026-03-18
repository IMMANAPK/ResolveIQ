import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
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
    @InjectRepository(Complaint) private complaintRepo: Repository<Complaint>,
  ) {}

  /**
   * Main entry point after a complaint is filed.
   * 1. Ask Groq AI which committee should handle this complaint
   * 2. Find committee members of that specific committee (by department)
   * 3. Exclude the person who filed the complaint (they may also be a committee member)
   * 4. Send notification emails to the selected members
   * 5. Auto-set complaint status to ASSIGNED
   */
  async notifyCommittee(complaint: Complaint): Promise<void> {
    // ── Step 1: AI routing ──────────────────────────────────────────────────
    const routing = await this.aiService.routeComplaint(complaint.title, complaint.description);
    this.logger.log(
      `Groq routed complaint "${complaint.title}" → "${routing.committee}" (${routing.confidence} confidence). Reason: ${routing.reason}`,
    );

    // ── Step 2: Filter committee members by the AI-chosen committee ─────────
    const allMembers = await this.usersService.getCommitteeMembers();
    let recipients = allMembers.filter(
      (u) => u.department?.toLowerCase() === routing.committee.toLowerCase(),
    );

    // If no members found for the specific committee, fall back to ALL committee members
    if (recipients.length === 0) {
      this.logger.warn(
        `No members found for "${routing.committee}", falling back to all committee members`,
      );
      recipients = allMembers;
    }

    // ── Step 3: Exclude the person who filed the complaint ──────────────────
    const filerExcluded = recipients.filter((u) => u.id !== complaint.raisedById);
    if (filerExcluded.length < recipients.length) {
      this.logger.log(
        `Excluded complaint filer (id: ${complaint.raisedById}) from notification recipients`,
      );
    }
    recipients = filerExcluded;

    if (recipients.length === 0) {
      this.logger.warn(
        `No recipients left after exclusions for complaint ${complaint.id}. Skipping notification.`,
      );
      return;
    }

    // ── Step 4: Send notifications ──────────────────────────────────────────
    const messagePrefix = `A new complaint has been submitted and assigned to the ${routing.committee} for review.\n\nReason: ${routing.reason}`;
    await this.sendNotificationToRecipients({
      complaint,
      recipients,
      type: NotificationType.INITIAL,
      messagePrefix,
    });

    // ── Step 5: Auto-set complaint status to ASSIGNED ───────────────────────
    try {
      await this.complaintRepo.update(complaint.id, { status: ComplaintStatus.ASSIGNED });
      this.logger.log(`Complaint ${complaint.id} status set to ASSIGNED`);
    } catch (err) {
      this.logger.error(`Failed to update complaint ${complaint.id} status to ASSIGNED`, err);
    }
  }

  async notifyManagers(complaint: Complaint): Promise<void> {
    const managers = await this.usersService.getManagers();
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
