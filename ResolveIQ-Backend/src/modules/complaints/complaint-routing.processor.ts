import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, RoutingMethod } from './entities/complaint.entity';
import { AiService } from '../ai/ai.service';
import { CommitteesService } from '../committees/committees.service';
import { NotificationRulesService } from '../notifications/notification-rules.service';
import { ComplaintNotifierService } from './complaint-notifier.service';

@Processor('complaint-routing')
export class ComplaintRoutingProcessor {
  private readonly logger = new Logger(ComplaintRoutingProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly committeesService: CommitteesService,
    private readonly rulesService: NotificationRulesService,
    private readonly notifier: ComplaintNotifierService,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    private readonly configService: ConfigService,
  ) {}

  @Process()
  async handleRouting(job: Job<{ complaintId: string }>) {
    const { complaintId } = job.data;
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['raisedBy'],
    });
    if (!complaint) return;

    const threshold = parseFloat(
      this.configService.get('ROUTING_CONFIDENCE_THRESHOLD', '0.7'),
    );

    // Step 1: AI routing
    let committeeId: string | undefined;
    let routingMethod = RoutingMethod.AI;
    let routingConfidence: number | undefined;
    let routingReason: string | undefined;
    let rawResponse: Record<string, unknown> | undefined;

    try {
      const result = await this.aiService.routeComplaintWithConfidence({
        title: complaint.title,
        description: complaint.description,
        aiSummary: complaint.aiSummary ?? undefined,
      });

      routingConfidence = result.confidence;
      routingReason = result.reason;
      rawResponse = result as unknown as Record<string, unknown>;

      if (result.confidence >= threshold) {
        const committee = await this.committeesService.findAll()
          .then((cs) => cs.find((c) => c.name === result.committee));
        committeeId = committee?.id;
      }
    } catch (error) {
      this.logger.error(`AI routing failed for ${complaintId}: ${error}`);
    }

    // Step 2: Fallback chain
    if (!committeeId) {
      routingMethod = RoutingMethod.CATEGORY;
      const byCat = await this.committeesService.findByCategory(complaint.category);
      if (byCat) {
        committeeId = byCat.id;
        routingReason = `Category mapping: ${complaint.category} → ${byCat.name}`;
      } else {
        const fallback = await this.committeesService.findByCategory('other' as any);
        if (fallback) {
          committeeId = fallback.id;
          routingReason = `Fallback: other → ${fallback.name}`;
        } else {
          this.logger.warn(`No committee found for complaint ${complaintId}`);
          routingReason = 'No matching committee found';
        }
      }
    }

    // Step 3: Save routing result
    await this.complaintRepo.update(complaintId, {
      committeeId,
      routingMethod,
      routingConfidence,
      routingReason,
      routingRawAiResponse: rawResponse as any,
    });
    complaint.committeeId = committeeId; // update in memory for fast passing

    // Step 4: Resolve notification recipients and send
    if (!complaint.notificationSentAt) {
      let notified = false;

      if (committeeId) {
        const recipientIds = await this.rulesService.resolveRecipients(committeeId, {
          priority: complaint.priority,
          category: complaint.category,
        });

        if (recipientIds.length > 0) {
          await this.notifier.sendToRecipientIds({
            complaint,
            recipientUserIds: recipientIds,
            includeAiSummary: complaint.aiSummaryStatus === 'completed',
          });
          notified = true;
        }
      }

      if (!notified) {
        // Fallback: no notification rules configured for this committee.
        // Notify the committee manager (or all managers if no committee manager assigned).
        this.logger.warn(
          `No notification rules for committee ${committeeId ?? 'NONE'} — falling back to manager notification`,
        );
        await this.notifier.notifyManagers(complaint);
      }

      await this.complaintRepo.update(complaintId, { notificationSentAt: new Date() });
    }

    this.logger.log(`Routed complaint ${complaintId} to committee ${committeeId ?? 'NONE'} via ${routingMethod}`);
  }
}
