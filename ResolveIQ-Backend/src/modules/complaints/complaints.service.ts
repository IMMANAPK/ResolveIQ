import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory, AiSummaryStatus } from './entities/complaint.entity';
import { ComplaintNotifierService } from './complaint-notifier.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

const SLA_HOURS: Record<ComplaintPriority, number> = {
  [ComplaintPriority.CRITICAL]: 4,
  [ComplaintPriority.HIGH]: 12,
  [ComplaintPriority.MEDIUM]: 24,
  [ComplaintPriority.LOW]: 72,
};

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

  async updateStatus(
    id: string,
    status: ComplaintStatus,
    resolutionNotes?: string,
    notifyComplainant = false,
    updatedByUser?: { id: string; fullName?: string; email?: string },
  ): Promise<Complaint> {
    const complaint = await this.findOrFail(id);
    complaint.status = status;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    // Fix: set resolvedAt for both resolved AND closed
    if (status === ComplaintStatus.RESOLVED || status === ComplaintStatus.CLOSED) {
      complaint.resolvedAt = new Date();
    }
    const saved = await this.repo.save(complaint);
    this.eventEmitter.emit('complaint.status_changed', { complaintId: id, newStatus: status });

    if (notifyComplainant) {
      this.notifier.sendStatusChangeEmail(saved, updatedByUser)
        .catch(e => this.logger.error('sendStatusChangeEmail failed', e));
    }

    return saved;
  }

  async getStats(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const qb = this.repo.createQueryBuilder('c');

    // Total count
    const total = await qb
      .where('c."createdAt" >= :since', { since })
      .getCount();

    // By status
    const byStatusRaw = await this.repo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."createdAt" >= :since', { since })
      .groupBy('c.status')
      .getRawMany();
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) byStatus[row.status] = row.count;

    // By priority
    const byPriorityRaw = await this.repo
      .createQueryBuilder('c')
      .select('c.priority', 'priority')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."createdAt" >= :since', { since })
      .groupBy('c.priority')
      .getRawMany();
    const byPriority: Record<string, number> = {};
    for (const row of byPriorityRaw) byPriority[row.priority] = row.count;

    // By category
    const byCategoryRaw = await this.repo
      .createQueryBuilder('c')
      .select('c.category', 'category')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."createdAt" >= :since', { since })
      .groupBy('c.category')
      .getRawMany();
    const byCategory: Record<string, number> = {};
    for (const row of byCategoryRaw) byCategory[row.category] = row.count;

    // By sentiment (null grouped as 'unknown')
    const bySentimentRaw = await this.repo
      .createQueryBuilder('c')
      .select("COALESCE(c.\"sentimentLabel\", 'unknown')", 'label')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."createdAt" >= :since', { since })
      .groupBy("COALESCE(c.\"sentimentLabel\", 'unknown')")
      .getRawMany();
    const bySentiment: Record<string, number> = {};
    for (const row of bySentimentRaw) bySentiment[row.label] = row.count;

    // Over time (last N days) — created
    const overTimeCreated = await this.repo
      .createQueryBuilder('c')
      .select("TO_CHAR(DATE_TRUNC('day', c.\"createdAt\"), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)::int', 'created')
      .where('c."createdAt" >= :since', { since })
      .groupBy("DATE_TRUNC('day', c.\"createdAt\")")
      .orderBy("DATE_TRUNC('day', c.\"createdAt\")", 'ASC')
      .getRawMany();

    // Over time — resolved
    const overTimeResolved = await this.repo
      .createQueryBuilder('c')
      .select("TO_CHAR(DATE_TRUNC('day', c.\"resolvedAt\"), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)::int', 'resolved')
      .where('c."resolvedAt" >= :since', { since })
      .andWhere('c."resolvedAt" IS NOT NULL')
      .groupBy("DATE_TRUNC('day', c.\"resolvedAt\")")
      .orderBy("DATE_TRUNC('day', c.\"resolvedAt\")", 'ASC')
      .getRawMany();

    // Merge over time
    const dateMap = new Map<string, { date: string; created: number; resolved: number }>();
    for (const row of overTimeCreated) {
      dateMap.set(row.date, { date: row.date, created: row.created, resolved: 0 });
    }
    for (const row of overTimeResolved) {
      const existing = dateMap.get(row.date);
      if (existing) {
        existing.resolved = row.resolved;
      } else {
        dateMap.set(row.date, { date: row.date, created: 0, resolved: row.resolved });
      }
    }
    const overTime = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Avg resolution hours
    const avgRes = await this.repo
      .createQueryBuilder('c')
      .select('AVG(EXTRACT(EPOCH FROM (c."resolvedAt" - c."createdAt")) / 3600)', 'avg')
      .where('c."createdAt" >= :since', { since })
      .andWhere('c."resolvedAt" IS NOT NULL')
      .getRawOne();
    const avgResolutionHours = avgRes?.avg ? parseFloat(avgRes.avg) : null;

    // SLA stats
    const slaBreachCount = await this.repo
      .createQueryBuilder('c')
      .where('c."createdAt" >= :since', { since })
      .andWhere('c."slaBreached" = true')
      .getCount();
    const slaBreachRate = total > 0 ? slaBreachCount / total : 0;

    // Avg feedback rating — requires joining feedback table
    const avgFeedbackRaw = await this.repo.manager
      .createQueryBuilder()
      .select('AVG(f.rating)', 'avg')
      .from('feedback', 'f')
      .innerJoin('complaints', 'c', 'c.id = f."complaintId"')
      .where('c."createdAt" >= :since', { since })
      .getRawOne();
    const avgFeedbackRating = avgFeedbackRaw?.avg ? parseFloat(avgFeedbackRaw.avg) : null;

    // Committee workload
    const committeeWorkload = await this.repo.manager
      .createQueryBuilder()
      .select('com.name', 'committeeName')
      .addSelect('COUNT(c.id)::int', 'count')
      .addSelect('AVG(f.rating)', 'avgRating')
      .from('committees', 'com')
      .leftJoin('complaints', 'c', 'c."committeeId" = com.id AND c."createdAt" >= :since', { since })
      .leftJoin('feedback', 'f', 'f."complaintId" = c.id')
      .groupBy('com.id')
      .addGroupBy('com.name')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      total,
      byStatus,
      byPriority,
      byCategory,
      bySentiment,
      overTime,
      avgResolutionHours,
      slaBreachCount,
      slaBreachRate: parseFloat(slaBreachRate.toFixed(4)),
      avgFeedbackRating: avgFeedbackRating ? parseFloat(avgFeedbackRating.toFixed(2)) : null,
      committeeWorkload: committeeWorkload.map((r: any) => ({
        committeeName: r.committeeName,
        count: r.count,
        avgRating: r.avgRating ? parseFloat(parseFloat(r.avgRating).toFixed(2)) : null,
      })),
    };
  }

  async createAndNotify(data: CreateComplaintData): Promise<Complaint> {
    // Create base complaint, then stamp AI summary fields directly on the entity
    const entity = this.repo.create({
      ...data,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryRequestedAt: new Date(),
    });
    const complaint = await this.repo.save(entity);

    // Compute SLA deadline based on priority
    const slaHours = SLA_HOURS[complaint.priority] ?? 24;
    const slaDeadline = new Date(complaint.createdAt.getTime() + slaHours * 3600000);
    await this.repo.update(complaint.id, { slaDeadline });
    complaint.slaDeadline = slaDeadline; // keep in-memory object consistent

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
