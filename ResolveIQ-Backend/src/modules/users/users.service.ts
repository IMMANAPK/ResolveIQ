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

  async getAvailableCommitteeMembers(): Promise<User[]> {
    const all = await this.repo.find({ where: { isActive: true, isAvailable: true } });
    return all.filter(u => u.roles.includes(UserRole.COMMITTEE_MEMBER));
  }

  async getCommitteeMembers(): Promise<User[]> {
    const all = await this.repo.find({ where: { isActive: true } });
    return all.filter(u => u.roles.includes(UserRole.COMMITTEE_MEMBER));
  }

  async getManagers(): Promise<User[]> {
    const all = await this.repo.find({ where: { isActive: true } });
    return all.filter(u => u.roles.includes(UserRole.MANAGER));
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
}
