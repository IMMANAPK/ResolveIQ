import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Notification } from './notification.entity';
import { User } from '../../users/entities/user.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('notification_recipients')
export class NotificationRecipient extends BaseEntity {
  @ManyToOne(() => Notification, (n) => n.recipients)
  @JoinColumn()
  notification: Notification;

  @Column()
  notificationId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipientId' })
  recipient: User;

  @Column()
  recipientId: string;

  @Column({ unique: true })
  trackingId: string;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  deliveryStatus: DeliveryStatus;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ nullable: true })
  readAt?: Date;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: 0 })
  reminderCount: number;
}
