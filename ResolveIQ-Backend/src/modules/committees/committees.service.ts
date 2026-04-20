import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Committee } from './entities/committee.entity';
import { CreateCommitteeDto, UpdateCommitteeDto } from './dto/committee.dto';
import { ComplaintCategory } from '../complaints/entities/complaint.entity';

@Injectable()
export class CommitteesService {
  constructor(
    @InjectRepository(Committee) private repo: Repository<Committee>,
  ) {}

  findAll(): Promise<Committee[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Committee> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Committee ${id} not found`);
    return c;
  }

  create(dto: CreateCommitteeDto): Promise<Committee> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateCommitteeDto): Promise<Committee> {
    await this.findById(id);
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.repo.delete(id);
  }

  async findByName(name: string): Promise<Committee | null> {
    return this.repo.findOne({ where: { name } });
  }

  /** Find which committee handles a given complaint category */
  async findByCategory(category: ComplaintCategory): Promise<Committee | null> {
    return this.repo
      .createQueryBuilder('c')
      .where('c.categories @> :cat::jsonb', { cat: JSON.stringify([category]) })
      .leftJoinAndSelect('c.manager', 'm')
      .getOne();
  }

  /** Get all committee names (for AI routing prompt) */
  async getCommitteeNames(): Promise<string[]> {
    return this.repo.find().then((all) => all.map((c) => c.name));
  }

  /** Get committees with their descriptions for AI prompt */
  async getCommitteesForAi(): Promise<{ name: string; description: string; categories: string[] }[]> {
    const all = await this.repo.find();
    return all.map((c) => ({
      name: c.name,
      description: c.description ?? '',
      categories: c.categories ?? [],
    }));
  }
}
