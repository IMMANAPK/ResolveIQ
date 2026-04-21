import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowRun, WorkflowRunStatus, WorkflowTriggeredBy } from './entities/workflow-run.entity';
import { WorkflowStepLog } from './entities/workflow-step-log.entity';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @InjectRepository(WorkflowDefinition) private readonly defRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowRun) private readonly runRepo: Repository<WorkflowRun>,
    @InjectRepository(WorkflowStepLog) private readonly logRepo: Repository<WorkflowStepLog>,
    @InjectQueue('workflow-steps') private readonly stepsQueue: Queue,
  ) {}

  @OnEvent('complaint.created')
  async onComplaintCreated(payload: { complaintId: string }) {
    await this.triggerByEvent('complaint.created', payload.complaintId);
  }

  @OnEvent('complaint.status_changed')
  async onStatusChanged(payload: { complaintId: string }) {
    await this.triggerByEvent('complaint.status_changed', payload.complaintId);
  }

  @OnEvent('complaint.escalated')
  async onComplaintEscalated(payload: { complaintId: string }) {
    await this.triggerByEvent('complaint.escalated', payload.complaintId);
  }

  async triggerByEvent(event: string, complaintId: string): Promise<WorkflowRun[]> {
    const activeDefs = await this.defRepo.find({ where: { isActive: true } });
    const matched = activeDefs.filter(d => d.trigger?.type === 'event' && d.trigger?.event === event);
    
    const runs: WorkflowRun[] = [];
    for (const def of matched) {
      runs.push(await this.startRun(def, complaintId, WorkflowTriggeredBy.EVENT));
    }
    return runs;
  }

  async triggerManual(workflowId: string, complaintId: string): Promise<WorkflowRun | null> {
    const def = await this.defRepo.findOneBy({ id: workflowId });
    if (!def) return null;
    return this.startRun(def, complaintId, WorkflowTriggeredBy.MANUAL);
  }

  /**
   * Dry-run: creates a real WorkflowRun record with dryRun=true, pushes step jobs
   * that skip side-effect nodes (send_notification, send_email, update_complaint)
   * but execute ai_prompt nodes live (real Groq calls).
   * Returns the run so the caller can poll for step logs.
   */
  async dryRun(workflowId: string, complaintId: string): Promise<WorkflowRun | null> {
    const def = await this.defRepo.findOneBy({ id: workflowId });
    if (!def) return null;

    const run = this.runRepo.create({
      workflowId: def.id,
      definitionVersion: def.definitionVersion,
      complaintId,
      status: WorkflowRunStatus.RUNNING,
      triggeredBy: WorkflowTriggeredBy.MANUAL,
      context: {},
      startedAt: new Date(),
    });
    await this.runRepo.save(run);

    const triggerNode = def.definition.nodes.find((n: any) => n.type === 'trigger');
    if (triggerNode) {
      await this.stepsQueue.add({
        runId: run.id,
        nodeId: triggerNode.id,
        dryRun: true, // propagated through all subsequent step jobs
      });
    } else {
      await this.runRepo.update(run.id, { status: WorkflowRunStatus.FAILED, error: 'No trigger node' });
    }

    return run;
  }

  private async startRun(def: WorkflowDefinition, complaintId: string, triggeredBy: WorkflowTriggeredBy) {
    const run = this.runRepo.create({
      workflowId: def.id,
      definitionVersion: def.definitionVersion,
      complaintId,
      status: WorkflowRunStatus.RUNNING,
      triggeredBy,
      context: {},
      startedAt: new Date(),
    });
    await this.runRepo.save(run);

    const triggerNode = def.definition.nodes.find((n: any) => n.type === 'trigger');
    if (triggerNode) {
      await this.stepsQueue.add({
        runId: run.id,
        nodeId: triggerNode.id,
        dryRun: false,
      });
    } else {
      await this.runRepo.update(run.id, { status: WorkflowRunStatus.FAILED, error: 'No trigger node' });
    }

    return run;
  }

  async getWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
    return this.runRepo.find({ where: { workflowId }, order: { createdAt: 'DESC' } });
  }

  async getRunsForComplaint(complaintId: string): Promise<WorkflowRun[]> {
    return this.runRepo.find({ where: { complaintId }, order: { createdAt: 'DESC' }, relations: ['workflow'] });
  }
}
