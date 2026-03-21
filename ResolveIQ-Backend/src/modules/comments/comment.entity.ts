import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { User } from '../users/entities/user.entity';

@Entity('complaint_comments')
@Index(['complaintId', 'isInternal', 'createdAt'])
@Index(['authorId'])
export class ComplaintComment extends BaseEntity {
  @Column()
  complaintId: string;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  isInternal: boolean;

  @Column({ type: 'varchar', nullable: true })
  authorRole?: string;
}
