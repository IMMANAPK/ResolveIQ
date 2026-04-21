import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids || ids.length === 0) return [];
    return this.repo.find({ where: { id: In(ids) } });
  }

  async getMembersByCommittee(committeeId: string): Promise<User[]> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.committeeId = :committeeId', { committeeId })
      .andWhere('u.roles @> :role::jsonb', { role: JSON.stringify([UserRole.COMMITTEE_MEMBER]) })
      .getMany();
  }

  async getAvailableCommitteeMembers(): Promise<User[]> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.isAvailable = :available', { available: true })
      .andWhere('u.roles @> :role::jsonb', { role: JSON.stringify([UserRole.COMMITTEE_MEMBER]) })
      .getMany();
  }

  async getCommitteeMembers(): Promise<User[]> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.roles @> :role::jsonb', { role: JSON.stringify([UserRole.COMMITTEE_MEMBER]) })
      .getMany();
  }

  async getManagers(): Promise<User[]> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.isActive = :active', { active: true })
      .andWhere('u.roles @> :role::jsonb', { role: JSON.stringify([UserRole.MANAGER]) })
      .getMany();
  }

  async findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async createUser(data: {
    email: string;
    password: string;
    fullName: string;
    roles: UserRole[];
    department?: string;
    phone?: string;
  }): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException(`Email ${data.email} is already registered`);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({ ...data, passwordHash });
    return this.repo.save(user);
  }

  async updateAvailability(userId: string, isAvailable: boolean, unavailableUntil?: Date): Promise<void> {
    await this.repo.update(userId, { isAvailable, unavailableUntil });
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.repo.update(userId, { fcmToken });
  }

  async updateCommittee(userId: string, committeeId: string | null): Promise<void> {
    await this.repo.update(userId, { committeeId: committeeId ?? undefined });
  }

  async getMembersByCommitteeId(committeeId: string): Promise<User[]> {
    const all = await this.repo.find({ where: { committeeId, isActive: true } });
    return all.filter(u => u.roles.includes(UserRole.COMMITTEE_MEMBER));
  }
}
