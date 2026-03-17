import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Complaint } from './complaint.entity';
import { User } from '../../users/entities/user.entity';

export enum TimelineEventType {
  CREATED = 'created',
  EMAIL_SENT = 'email_sent',
  VIEWED = 'viewed',
  REMINDER = 'reminder',
  ESCALATION = 'escalation',
  REASSIGNMENT = 'reassignment',
  RESOLVED = 'resolved',
  COMMENT = 'comment',
}

@Entity('timeline_events')
export class TimelineEvent extends BaseEntity {
  @Column({ type: 'enum', enum: TimelineEventType })
  type: TimelineEventType;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;
}
