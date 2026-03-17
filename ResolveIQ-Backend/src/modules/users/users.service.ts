import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async getAvailableCommitteeMembers(): Promise<User[]> {
    return this.repo.find({
      where: { role: UserRole.COMMITTEE_MEMBER, isActive: true, isAvailable: true },
    });
  }

  async getCommitteeMembers(): Promise<User[]> {
    return this.repo.find({ where: { role: UserRole.COMMITTEE_MEMBER, isActive: true } });
  }

  async getManagers(): Promise<User[]> {
    return this.repo.find({ where: { role: UserRole.MANAGER, isActive: true } });
  }

  async findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async createUser(data: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
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
