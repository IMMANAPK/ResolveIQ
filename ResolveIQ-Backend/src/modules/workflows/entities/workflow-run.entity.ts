import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WorkflowDefinition } from './workflow-definition.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';

export enum WorkflowRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

export enum WorkflowTriggeredBy {
  EVENT = 'event',
  MANUAL = 'manual',
}

@Entity('workflow_runs')
export class WorkflowRun extends BaseEntity {
  @Column()
  workflowId: string;

  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'workflowId' })
  workflow: WorkflowDefinition;

  @Column({ type: 'int' })
  definitionVersion: number;

  @Column()
  complaintId: string;

  @ManyToOne(() => Complaint)
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'enum', enum: WorkflowRunStatus, default: WorkflowRunStatus.RUNNING })
  status: WorkflowRunStatus;

  @Column({ type: 'enum', enum: WorkflowTriggeredBy })
  triggeredBy: WorkflowTriggeredBy;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  error?: string;
}
