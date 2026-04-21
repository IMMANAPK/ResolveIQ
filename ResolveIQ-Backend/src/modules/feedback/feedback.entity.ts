import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { User } from '../users/entities/user.entity';

@Entity('feedback')
@Unique(['complaintId'])
export class Feedback extends BaseEntity {
  @ManyToOne(() => Complaint)
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  rating: number; // 1-5

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'text', nullable: true })
  aiSummary?: string;
}
