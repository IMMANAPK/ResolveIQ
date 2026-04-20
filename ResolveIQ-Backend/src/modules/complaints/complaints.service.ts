import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from './entities/complaint.entity';
import { EventsGateway } from '../gateway/events.gateway';
import { COMPLAINT_ROUTING_QUEUE, ComplaintRoutingJobData } from './complaint-routing.processor';

export interface CreateComplaintData {
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  raisedById: string;
}

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    @InjectRepository(Complaint) private repo: Repository<Complaint>,
    @InjectQueue(COMPLAINT_ROUTING_QUEUE) private routingQueue: Queue,
    private eventsGateway: EventsGateway,
  ) {}

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
    const updated = await this.repo.save(complaint);
    this.eventsGateway.emitComplaintUpdated({ complaintId: id, status });
    return updated;
  }

  async createAndNotify(data: CreateComplaintData): Promise<Complaint> {
    const complaint = await this.create(data);
    await this.routingQueue.add(
      'route-complaint',
      { complaintId: complaint.id } as ComplaintRoutingJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true },
    );
    return complaint;
  }
}
