import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';

export enum EscalationStep {
  REMINDER = 'reminder',
  REROUTE = 'reroute',
  MULTI_CHANNEL = 'multi_channel',
}

export enum EscalationStatus {
  TRIGGERED = 'triggered',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('escalation_logs')
export class EscalationLog extends BaseEntity {
  @ManyToOne(() => Complaint)
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @Column()
  originalNotificationId: string;

  @Column()
  targetUserId: string;

  @Column({ type: 'enum', enum: EscalationStep })
  step: EscalationStep;

  @Column({ type: 'enum', enum: EscalationStatus, default: EscalationStatus.TRIGGERED })
  status: EscalationStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  aiGeneratedSubject?: string;

  @Column({ type: 'text', nullable: true })
  aiGeneratedBody?: string;
}
