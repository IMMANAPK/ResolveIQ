import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from './entities/complaint.entity';
import { TimelineEvent, TimelineEventType } from './entities/timeline-event.entity';
import { AIAction, AIActionType } from './entities/ai-action.entity';
import { ComplaintNotifierService } from './complaint-notifier.service';

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
    @InjectRepository(TimelineEvent) private timelineRepo: Repository<TimelineEvent>,
    @InjectRepository(AIAction) private aiActionRepo: Repository<AIAction>,
    private notifier: ComplaintNotifierService,
  ) {}

  async create(data: CreateComplaintData): Promise<Complaint> {
    const complaint = this.repo.create(data);
    const saved = await this.repo.save(complaint);
    await this.addTimelineEvent(saved.id, TimelineEventType.CREATED, `Complaint created by ${data.raisedById}`);
    return saved;
  }

  async findById(id: string): Promise<Complaint | null> {
    return this.repo.findOne({
      where: { id },
      relations: [
        'raisedBy', 
        'timeline', 
        'aiActions', 
        'notifications', 
        'notifications.recipients', 
        'notifications.recipients.recipient'
      ],
      order: { timeline: { createdAt: 'DESC' } },
    });
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
    const oldStatus = complaint.status;
    complaint.status = status;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    if (status === ComplaintStatus.RESOLVED) complaint.resolvedAt = new Date();
    const saved = await this.repo.save(complaint);
    await this.addTimelineEvent(id, TimelineEventType.RESOLVED, `Status updated from ${oldStatus} to ${status}`);
    return saved;
  }

  async createAndNotify(data: CreateComplaintData): Promise<Complaint> {
    const complaint = await this.create(data);
    this.notifier.notifyCommittee(complaint).then(() => {
       this.addTimelineEvent(complaint.id, TimelineEventType.EMAIL_SENT, 'Notification emails sent to committee members');
    }).catch((err) =>
      this.logger.error('Failed to notify committee', err),
    );
    return complaint;
  }

  async addTimelineEvent(complaintId: string, type: TimelineEventType, description: string, userId?: string, metadata?: any) {
    const event = this.timelineRepo.create({ complaintId, type, description, userId, metadata });
    return this.timelineRepo.save(event);
  }

  async addAIAction(complaintId: string, type: AIActionType, message: string, tone?: string, metadata?: any) {
    const action = this.aiActionRepo.create({ complaintId, type, message, tone, metadata });
    return this.aiActionRepo.save(action);
  }
}
