import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';
import { NotificationRecipient } from './notification-recipient.entity';

export enum NotificationType {
  INITIAL = 'initial',
  REMINDER = 'reminder',
  ESCALATION = 'escalation',
  RE_ROUTED = 're_routed',
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
}

@Entity('notifications')
@Index(['complaintId'])
@Index(['type'])
@Index(['createdAt'])
export class Notification extends BaseEntity {
  @ManyToOne(() => Complaint)
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.INITIAL })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.EMAIL })
  channel: NotificationChannel;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  allRead: boolean;

  @OneToMany(() => NotificationRecipient, (r) => r.notification, { cascade: true, eager: true })
  recipients: NotificationRecipient[];
}
