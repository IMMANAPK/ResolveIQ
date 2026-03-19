import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory, AiSummaryStatus } from './entities/complaint.entity';
import { ComplaintNotifierService } from './complaint-notifier.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    @InjectRepository(Complaint) private readonly repo: Repository<Complaint>,
    private readonly notifier: ComplaintNotifierService,
    @InjectQueue('ai-summary') private readonly aiSummaryQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
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
    const saved = await this.repo.save(complaint);
    this.eventEmitter.emit('complaint.status_changed', { complaintId: id, newStatus: status });
    return saved;
  }

  async createAndNotify(data: CreateComplaintData): Promise<Complaint> {
    // Create base complaint, then stamp AI summary fields directly on the entity
    const entity = this.repo.create({
      ...data,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryRequestedAt: new Date(),
    });
    const complaint = await this.repo.save(entity);

    // Fire-and-forget — never let queue issues block the HTTP response
    this.aiSummaryQueue
      .add(
        { complaintId: complaint.id },
        { timeout: 30000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      )
      .catch((err) =>
        this.logger.error(`Failed to queue AI summary for complaint ${complaint.id}: ${err}`),
      );

    this.eventEmitter.emit('complaint.created', { complaintId: complaint.id });

    return complaint;
  }

  async regenerateSummary(id: string): Promise<void> {
    const complaint = await this.findOrFail(id);

    await this.repo.update(id, {
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryRequestedAt: new Date(),
      aiSummaryError: null as any,
      aiSummary: null as any,
    });

    // Fire-and-forget — same pattern as createAndNotify
    this.aiSummaryQueue
      .add(
        { complaintId: id },
        { timeout: 30000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      )
      .catch((err) =>
        this.logger.error(`Failed to re-queue AI summary for complaint ${id}: ${err}`),
      );
  }
}
