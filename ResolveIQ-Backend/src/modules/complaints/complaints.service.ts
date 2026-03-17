import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from './entities/complaint.entity';

export interface CreateComplaintData {
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  raisedById: string;
}

@Injectable()
export class ComplaintsService {
  constructor(@InjectRepository(Complaint) private repo: Repository<Complaint>) {}

  async create(data: CreateComplaintData): Promise<Complaint> {
    const complaint = this.repo.create(data);
    return this.repo.save(complaint);
  }

  async findById(id: string): Promise<Complaint | null> {
    return this.repo.findOne({ where: { id }, relations: ['raisedBy'] });
  }

  async findOrFail(id: string): Promise<Complaint> {
    const c = await this.findById(id);
    if (!c) throw new NotFoundException(`Complaint ${id} not found`);
    return c;
  }

  async findByUser(userId: string): Promise<Complaint[]> {
    return this.repo.find({ where: { raisedById: userId }, order: { createdAt: 'DESC' } });
  }

  async findAll(filters?: { status?: ComplaintStatus; priority?: ComplaintPriority }): Promise<Complaint[]> {
    return this.repo.find({
      where: filters ?? {},
      order: { createdAt: 'DESC' },
      relations: ['raisedBy'],
    });
  }

  async updateStatus(id: string, status: ComplaintStatus, resolutionNotes?: string): Promise<Complaint> {
    const complaint = await this.findOrFail(id);
    complaint.status = status;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    if (status === ComplaintStatus.RESOLVED) complaint.resolvedAt = new Date();
    return this.repo.save(complaint);
  }
}
