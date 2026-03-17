import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { TimelineEvent } from './timeline-event.entity';
import { AIAction } from './ai-action.entity';
import { Notification } from '../../notifications/entities/notification.entity';

export enum ComplaintStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  ESCALATED = 'escalated',
}

export enum ComplaintPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ComplaintCategory {
  HR = 'hr',
  IT = 'it',
  FACILITIES = 'facilities',
  CONDUCT = 'conduct',
  SAFETY = 'safety',
  OTHER = 'other',
}

@Entity('complaints')
export class Complaint extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: ComplaintCategory, default: ComplaintCategory.OTHER })
  category: ComplaintCategory;

  @Column({ type: 'enum', enum: ComplaintPriority, default: ComplaintPriority.MEDIUM })
  priority: ComplaintPriority;

  @Column({ type: 'enum', enum: ComplaintStatus, default: ComplaintStatus.OPEN })
  status: ComplaintStatus;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  raisedBy: User;

  @Column()
  raisedById: string;

  @Column({ nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;

  @OneToMany(() => TimelineEvent, (event) => event.complaint)
  timeline: TimelineEvent[];

  @OneToMany(() => AIAction, (action) => action.complaint)
  aiActions: AIAction[];

  @OneToMany(() => Notification, (notification) => notification.complaint)
  notifications: Notification[];
}
