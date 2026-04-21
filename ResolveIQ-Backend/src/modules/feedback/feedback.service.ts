import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './feedback.entity';
import { Complaint, ComplaintStatus } from '../complaints/entities/complaint.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    private readonly aiService: AiService,
  ) {}

  async findByComplaint(complaintId: string): Promise<Feedback | null> {
    return this.feedbackRepo.findOne({ where: { complaintId }, relations: ['user'] });
  }

  async create(complaintId: string, userId: string, data: { rating: number; comment?: string }): Promise<Feedback> {
    // Validate complaint exists and is resolved/closed
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.status !== ComplaintStatus.RESOLVED && complaint.status !== ComplaintStatus.CLOSED) {
      throw new BadRequestException('Feedback can only be submitted for resolved or closed complaints');
    }

    // Validate user is the complainant
    if (complaint.raisedById !== userId) {
      throw new BadRequestException('Only the complainant can submit feedback');
    }

    // Check for existing feedback
    const existing = await this.feedbackRepo.findOne({ where: { complaintId } });
    if (existing) throw new ConflictException('Feedback already submitted for this complaint');

    const feedback = this.feedbackRepo.create({
      complaintId,
      userId,
      rating: data.rating,
      comment: data.comment,
    });
    const saved = await this.feedbackRepo.save(feedback);

    // Fire-and-forget AI summary if comment is non-empty
    if (data.comment && data.comment.trim().length > 0) {
      this.aiService
        .summarizeFeedback({
          complaintTitle: complaint.title,
          rating: data.rating,
          comment: data.comment,
        })
        .then(async (summary) => {
          await this.feedbackRepo.update(saved.id, { aiSummary: summary });
          this.logger.log(`AI summary generated for feedback ${saved.id}`);
        })
        .catch((err) => {
          this.logger.warn(`AI feedback summary failed for ${saved.id}: ${err}`);
        });
    }

    return saved;
  }
}
