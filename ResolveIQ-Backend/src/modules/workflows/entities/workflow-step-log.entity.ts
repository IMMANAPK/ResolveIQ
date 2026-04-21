import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WorkflowRun } from './workflow-run.entity';

export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('workflow_step_logs')
export class WorkflowStepLog extends BaseEntity {
  @Column()
  runId: string;

  @ManyToOne(() => WorkflowRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runId' })
  run: WorkflowRun;

  @Column()
  nodeId: string;

  @Column()
  nodeType: string;

  @Column({ type: 'enum', enum: StepStatus, default: StepStatus.PENDING })
  status: StepStatus;

  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  output?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  skippedReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  retryPolicy?: { maxAttempts: number; backoffMs: number };

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  error?: string;
}
