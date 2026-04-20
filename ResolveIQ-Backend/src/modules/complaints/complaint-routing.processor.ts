import { Process, Processor } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, ComplaintStatus } from './entities/complaint.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { CommitteesService } from '../committees/committees.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationType, NotificationChannel } from '../notifications/entities/notification.entity';
import { EMAIL_QUEUE, EmailJobData } from '../email/email.processor';

export const COMPLAINT_ROUTING_QUEUE = 'complaint-routing';

export interface ComplaintRoutingJobData {
  complaintId: string;
}

@Processor(COMPLAINT_ROUTING_QUEUE)
export class ComplaintRoutingProcessor {
  private readonly logger = new Logger(ComplaintRoutingProcessor.name);

  constructor(
    @InjectRepository(Complaint) private complaintRepo: Repository<Complaint>,
    @InjectQueue(EMAIL_QUEUE) private emailQueue: Queue,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private committeesService: CommitteesService,
    private aiService: AiService,
    private emailService: EmailService,
    private eventsGateway: EventsGateway,
  ) {}

  @Process('route-complaint')
  async handleComplaintRouting(job: Job<ComplaintRoutingJobData>) {
    const { complaintId } = job.data;

    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['raisedBy'],
    });
    if (!complaint) {
      this.logger.warn(`Complaint ${complaintId} not found, skipping`);
      return;
    }

    // Route to committee — DB mapping first, Groq AI fallback
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
      this.logger.log(`AI routed "${complaint.title}" → "${targetCommitteeName}" (${routing.confidence})`);
    }

    // Find committee members via committeeId FK
    const targetCommittee = mappedCommittee ?? await this.committeesService.findByName(targetCommitteeName!);
    let recipients = targetCommittee
      ? await this.usersService.getMembersByCommittee(targetCommittee.id)
      : [];

    if (recipients.length === 0) {
      this.logger.warn(`No members for "${targetCommitteeName}", falling back to all committee members`);
      recipients = await this.usersService.getCommitteeMembers();
    }

    recipients = recipients.filter((u) => u.id !== complaint.raisedById);

    if (recipients.length === 0) {
      this.logger.warn(`No recipients after exclusions for complaint ${complaintId}, skipping`);
      return;
    }

    // Create notification record
    const subject = `[${complaint.priority.toUpperCase()}] Complaint: ${complaint.title}`;
    const messageBody = `A new complaint has been submitted and assigned to ${targetCommitteeName}.\n\nReason: ${routingReason}`;

    const notification = await this.notificationsService.createNotification({
      complaintId: complaint.id,
      type: NotificationType.INITIAL,
      channel: NotificationChannel.EMAIL,
      subject,
      body: messageBody,
      recipientIds: recipients.map((r) => r.id),
    });

    // Queue one email job per recipient — each gets independent retry logic
    const trackingMap = new Map(notification.recipients.map((nr) => [nr.recipientId, nr.trackingId]));
    await Promise.all(
      recipients.map(async (member) => {
        const trackingId = trackingMap.get(member.id);
        if (!trackingId) return;

        const html = this.emailService.buildNotificationHtml({
          recipientName: member.fullName,
          complaintTitle: complaint.title,
          complaintId: complaint.id,
          trackingId,
          message: messageBody,
          priority: complaint.priority,
        });

        await this.emailQueue.add(
          'send-email',
          { to: member.email, subject, html, trackingId } as EmailJobData,
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
        );
      }),
    );

    await this.complaintRepo.update(complaint.id, { status: ComplaintStatus.ASSIGNED });
    this.eventsGateway.emitComplaintUpdated({ complaintId: complaint.id, status: ComplaintStatus.ASSIGNED });

    this.logger.log(
      `Complaint ${complaintId} routed to "${targetCommitteeName}", ${recipients.length} email job(s) queued`,
    );
  }
}
