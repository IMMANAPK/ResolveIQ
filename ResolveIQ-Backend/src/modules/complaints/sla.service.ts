import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Complaint, ComplaintStatus } from './entities/complaint.entity';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectRepository(Complaint)
    private readonly repo: Repository<Complaint>,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSlaBreaches() {
    const result = await this.repo
      .createQueryBuilder()
      .update(Complaint)
      .set({ slaBreached: true, slaBreachedAt: () => 'NOW()' })
      .where('"slaDeadline" < NOW()')
      .andWhere('"slaBreached" = false')
      .andWhere('status NOT IN (:...statuses)', {
        statuses: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
      })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(`SLA breach detected: ${result.affected} complaint(s) marked as breached`);
    }
  }
}
