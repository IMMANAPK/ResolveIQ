import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, AiSummaryStatus, SentimentLabel } from '../complaints/entities/complaint.entity';
import { AiService } from './ai.service';
import { EventsGateway } from '../gateway/events.gateway';

@Processor('ai-summary')
export class AiSummaryProcessor {
  private readonly logger = new Logger(AiSummaryProcessor.name);

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    private readonly eventsGateway: EventsGateway,
    @InjectQueue('complaint-routing')
    private readonly routingQueue: Queue,
  ) {}

  @Process()
  async handleSummary(job: Job<{ complaintId: string }>) {
    const { complaintId } = job.data;
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) {
      this.logger.warn(`Complaint ${complaintId} not found, skipping summary`);
      return;
    }

    try {
      const summary = await this.aiService.generateSummary({
        title: complaint.title,
        description: complaint.description,
        category: complaint.category,
        priority: complaint.priority,
      });

      // Sentiment analysis — fire after summary, never blocks the pipeline
      let sentimentLabel: SentimentLabel | undefined;
      let sentimentScore: number | undefined;
      try {
        const sentiment = await this.aiService.analyzeSentiment({
          title: complaint.title,
          description: complaint.description,
        });
        sentimentLabel = sentiment.label;
        sentimentScore = sentiment.score;
        this.logger.log(`Sentiment for ${complaintId}: ${sentiment.label} (${sentiment.score})`);
      } catch (sentErr) {
        this.logger.warn(`Sentiment analysis failed for ${complaintId}, skipping: ${sentErr}`);
      }

      await this.complaintRepo.update(complaintId, {
        aiSummary: summary,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryCompletedAt: new Date(),
        ...(sentimentLabel && { sentimentLabel }),
        ...(sentimentScore !== undefined && { sentimentScore }),
      });

      this.logger.log(`Summary generated for complaint ${complaintId}`);
    } catch (error) {
      await this.complaintRepo.update(complaintId, {
        aiSummaryStatus: AiSummaryStatus.FAILED,
        aiSummaryError: error instanceof Error ? error.message : String(error),
      });

      this.logger.error(`Summary failed for complaint ${complaintId}: ${error}`);
    }

    // Emit WebSocket event to the complaint room
    this.eventsGateway.emitSummaryUpdated(complaintId);

    // Push Phase 2 routing job (processor created in Phase 2)
    await this.routingQueue.add({ complaintId }, { timeout: 30000, attempts: 3 });
  }
}
