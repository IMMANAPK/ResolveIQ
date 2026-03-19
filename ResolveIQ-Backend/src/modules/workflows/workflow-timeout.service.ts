import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowRun, WorkflowRunStatus } from './entities/workflow-run.entity';

@Injectable()
export class WorkflowTimeoutService {
  constructor(
    @InjectRepository(WorkflowRun)
    private readonly runRepo: Repository<WorkflowRun>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkTimeouts() {
    const runningRuns = await this.runRepo.find({
      where: { status: WorkflowRunStatus.RUNNING },
      relations: ['workflow'],
    });

    const now = Date.now();
    for (const run of runningRuns) {
      if (!run.startedAt) continue;
      const elapsed = (now - run.startedAt.getTime()) / 1000;
      if (elapsed > (run.workflow?.maxRunDurationSeconds ?? 300)) {
        await this.runRepo.update(run.id, {
          status: WorkflowRunStatus.TIMED_OUT,
          completedAt: new Date(),
          error: `Timed out after ${Math.round(elapsed)}s`,
        });
      }
    }
  }
}
