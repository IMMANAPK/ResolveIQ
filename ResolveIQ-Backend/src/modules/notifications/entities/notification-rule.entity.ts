import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Committee } from '../../committees/entities/committee.entity';

export enum NotificationRuleType {
  DEFAULT = 'default',
  CONDITIONAL = 'conditional',
}

export interface RuleCondition {
  field: 'priority' | 'category';
  op: 'eq' | 'neq';
  value: string;
}

@Entity('notification_rules')
export class NotificationRule extends BaseEntity {
  @Column()
  committeeId: string;

  @ManyToOne(() => Committee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'committeeId' })
  committee: Committee;

  @Column({ type: 'enum', enum: NotificationRuleType })
  type: NotificationRuleType;

  @Column({ type: 'jsonb', nullable: true })
  condition?: RuleCondition;

  @Column({ type: 'simple-array', default: '' })
  recipientUserIds: string[];

  @Column({ type: 'simple-array', default: '' })
  recipientRoles: string[];

  @Column({ type: 'int', default: 0 })
  order: number;
}
