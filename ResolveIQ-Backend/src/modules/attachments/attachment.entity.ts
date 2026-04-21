import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { User } from '../users/entities/user.entity';

@Entity('attachments')
export class Attachment extends BaseEntity {
  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @Column()
  url: string;

  @Column()
  publicId: string;

  @Column()
  resourceType: string;

  @Column()
  filename: string;

  @Column()
  mimetype: string;

  @Column({ type: 'int' })
  size: number;
}
