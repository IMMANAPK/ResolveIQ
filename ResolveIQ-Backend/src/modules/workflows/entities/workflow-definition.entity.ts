import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('workflow_definitions')
export class WorkflowDefinition extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb' })
  trigger: { type: 'event' | 'manual'; event?: string };

  @Column({ type: 'jsonb' })
  definition: { schemaVersion: number; nodes: any[]; edges: any[] };

  @Column({ type: 'int', default: 1 })
  schemaVersion: number;

  @Column({ type: 'int', default: 1 })
  definitionVersion: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'int', default: 300 })
  maxRunDurationSeconds: number;

  @Column({ nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;
}
