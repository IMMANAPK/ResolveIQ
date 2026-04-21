import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Committee } from '../../committees/entities/committee.entity';

export enum ComplaintStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
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

export enum AiSummaryStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RoutingMethod {
  AI = 'ai',
  CATEGORY = 'category',
  MANUAL = 'manual',
}

export type SentimentLabel = 'frustrated' | 'angry' | 'neutral' | 'concerned' | 'satisfied';

@Entity('complaints')
@Index(['status'])
@Index(['priority'])
@Index(['category'])
@Index(['raisedById'])
@Index(['committeeId'])
@Index(['createdAt'])
@Index(['slaDeadline'])
@Index(['status', 'committeeId']) // Composite index for common query pattern
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

  @Column({ type: 'text', nullable: true })
  aiSummary?: string;

  @Column({ type: 'enum', enum: AiSummaryStatus, nullable: true })
  aiSummaryStatus?: AiSummaryStatus;

  @Column({ type: 'timestamp', nullable: true })
  aiSummaryRequestedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  aiSummaryCompletedAt?: Date;

  @Column({ type: 'text', nullable: true })
  aiSummaryError?: string;

  @Column({ nullable: true })
  committeeId?: string;

  @ManyToOne(() => Committee, { nullable: true, eager: false })
  @JoinColumn({ name: 'committeeId' })
  committee?: Committee;

  @Column({ type: 'enum', enum: RoutingMethod, nullable: true })
  routingMethod?: RoutingMethod;

  @Column({ type: 'float', nullable: true })
  routingConfidence?: number;

  @Column({ type: 'text', nullable: true })
  routingReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  routingRawAiResponse?: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  notificationSentAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  sentimentLabel?: SentimentLabel;

  @Column({ type: 'float', nullable: true })
  sentimentScore?: number; // 0.0 (very negative) to 1.0 (very positive)

  @Column({ type: 'timestamptz', nullable: true })
  slaDeadline?: Date;

  @Column({ default: false })
  slaBreached: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  slaBreachedAt?: Date;
}
