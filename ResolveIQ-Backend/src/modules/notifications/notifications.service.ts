import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Notification, NotificationType, NotificationChannel } from './entities/notification.entity';
import { NotificationRecipient, DeliveryStatus } from './entities/notification-recipient.entity';

export interface CreateNotificationData {
  complaintId: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  body: string;
  recipientIds: string[];
}

export interface NotificationStatus {
  notificationId: string;
  totalRecipients: number;
  readCount: number;
  pendingCount: number;
  recipients: Array<{
    userId: string;
    isRead: boolean;
    readAt?: Date;
    deliveryStatus: DeliveryStatus;
    sentAt?: Date;
  }>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient) private recipientRepo: Repository<NotificationRecipient>,
  ) {}

  async createNotification(data: CreateNotificationData): Promise<Notification> {
    const notification = this.notifRepo.create({
      complaintId: data.complaintId,
      type: data.type,
      channel: data.channel,
      subject: data.subject,
      body: data.body,
    });
    const saved = await this.notifRepo.save(notification);

    const recipients = data.recipientIds.map((recipientId) =>
      this.recipientRepo.create({
        notificationId: saved.id,
        recipientId,
        trackingId: randomUUID(),
        deliveryStatus: DeliveryStatus.PENDING,
      }),
    );
    await this.recipientRepo.save(recipients);
    return this.notifRepo.findOne({ where: { id: saved.id }, relations: ['recipients'] }) as Promise<Notification>;
  }

  async markRecipientSent(trackingId: string, messageId?: string): Promise<void> {
    await this.recipientRepo.update(
      { trackingId },
      { deliveryStatus: DeliveryStatus.SENT, sentAt: new Date() },
    );
  }

  async markRecipientFailed(trackingId: string): Promise<void> {
    await this.recipientRepo.update({ trackingId }, { deliveryStatus: DeliveryStatus.FAILED });
  }

  async markRecipientAsRead(trackingId: string): Promise<NotificationRecipient | null> {
    const recipient = await this.recipientRepo.findOne({ where: { trackingId } });
    if (!recipient) return null;
    
    if (!recipient.isRead) {
      recipient.isRead = true;
      recipient.readAt = new Date();
      await this.recipientRepo.save(recipient);
      await this.checkAndMarkAllRead(recipient.notificationId);
    }

    // Always fetch with recipient details for the socket event
    return this.recipientRepo.findOne({
      where: { trackingId },
      relations: ['recipient']
    });
  }

  private async checkAndMarkAllRead(notificationId: string): Promise<void> {
    const recipients = await this.recipientRepo.find({ where: { notificationId } });
    const allRead = recipients.every((r) => r.isRead);
    if (allRead) await this.notifRepo.update(notificationId, { allRead: true });
  }

  async getNotificationStatus(notificationId: string): Promise<NotificationStatus> {
    const notification = await this.notifRepo.findOne({
      where: { id: notificationId },
      relations: ['recipients'],
    });
    if (!notification) throw new Error(`Notification ${notificationId} not found`);

    const recipients = notification.recipients ?? [];
    const readCount = recipients.filter((r) => r.isRead).length;
    return {
      notificationId,
      totalRecipients: recipients.length,
      readCount,
      pendingCount: recipients.length - readCount,
      recipients: recipients.map((r) => ({
        userId: r.recipientId,
        isRead: r.isRead,
        readAt: r.readAt,
        deliveryStatus: r.deliveryStatus,
        sentAt: r.sentAt,
      })),
    };
  }

  async getUnreadRecipients(notificationId: string): Promise<NotificationRecipient[]> {
    return this.recipientRepo.find({
      where: { notificationId, isRead: false },
      relations: ['recipient'],
    });
  }

  async getNotificationsForComplaint(complaintId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { complaintId },
      relations: ['recipients'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUnacknowledgedNotifications(olderThanMinutes: number): Promise<Notification[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return this.notifRepo
      .createQueryBuilder('n')
      .where('n.allRead = false')
      .andWhere('n.createdAt < :cutoff', { cutoff })
      .leftJoinAndSelect('n.recipients', 'r')
      .leftJoinAndSelect('r.recipient', 'u')
      .leftJoinAndSelect('n.complaint', 'c')
      .getMany();
  }

  async incrementReminderCount(recipientId: string): Promise<void> {
    await this.recipientRepo
      .createQueryBuilder()
      .update()
      .set({ reminderCount: () => 'reminderCount + 1' })
      .where('id = :recipientId', { recipientId })
      .execute();
  }
}
