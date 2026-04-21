import { Entity, Column } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum UserRole {
  ADMIN = 'admin',
  COMPLAINANT = 'complainant',
  COMMITTEE_MEMBER = 'committee_member',
  MANAGER = 'manager',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column()
  fullName: string;

  @Column({ type: 'jsonb', default: () => "'[\"complainant\"]'" })
  roles: UserRole[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  department?: string;

  @Column({ nullable: true })
  committeeId?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ nullable: true })
  unavailableUntil?: Date;

  @Column({ nullable: true })
  fcmToken?: string;

  @Column({ nullable: true })
  committeeId?: string;
}
