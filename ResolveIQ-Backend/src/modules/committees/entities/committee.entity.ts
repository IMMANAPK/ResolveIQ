import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { ComplaintCategory } from '../../complaints/entities/complaint.entity';

@Entity('committees')
export class Committee extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Complaint categories this committee handles (stored as comma-separated string) */
  @Column({ type: 'simple-array', default: '' })
  categories: ComplaintCategory[];

  /** Manager who oversees this committee (nullable — can be unassigned) */
  @Column({ nullable: true })
  managerId?: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'managerId' })
  manager?: User;
}
