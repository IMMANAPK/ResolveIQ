import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Complaint } from './complaint.entity';

export enum AIActionType {
  REMINDER = 'reminder',
  ESCALATION = 'escalation',
  REASSIGNMENT = 'reassignment',
  ANALYSIS = 'analysis',
}

@Entity('ai_actions')
export class AIAction extends BaseEntity {
  @Column({ type: 'enum', enum: AIActionType })
  type: AIActionType;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  tone?: string;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;
}
