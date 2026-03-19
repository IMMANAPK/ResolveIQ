import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowRun, WorkflowRunStatus } from './entities/workflow-run.entity';
import { WorkflowStepLog, StepStatus } from './entities/workflow-step-log.entity';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { Complaint } from '../complaints/entities/complaint.entity';
import { NodeHandlerContext, NodeHandlerResult } from './node-handlers';
import { triggerHandler } from './node-handlers/trigger.handler';
import { aiPromptHandler } from './node-handlers/ai-prompt.handler';
import { conditionHandler } from './node-handlers/condition.handler';
import { sendNotificationHandler } from './node-handlers/send-notification.handler';
import { sendEmailHandler } from './node-handlers/send-email.handler';
import { updateComplaintHandler } from './node-handlers/update-complaint.handler';
import { delayHandler } from './node-handlers/delay.handler';

@Processor('workflow-steps')
export class WorkflowStepProcessor {
  private readonly logger = new Logger(WorkflowStepProcessor.name);

  private handlers: Record<string, any> = {
    trigger: triggerHandler,
    ai_prompt: aiPromptHandler,
    condition: conditionHandler,
    send_notification: sendNotificationHandler,
    send_email: sendEmailHandler,
    update_complaint: updateComplaintHandler,
    delay: delayHandler,
  };

  constructor(
    @InjectRepository(WorkflowRun) private readonly runRepo: Repository<WorkflowRun>,
    @InjectRepository(WorkflowStepLog) private readonly logRepo: Repository<WorkflowStepLog>,
    @InjectRepository(Complaint) private readonly complaintRepo: Repository<Complaint>,
    private readonly aiService: AiService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    @InjectQueue('workflow-steps') private readonly stepsQueue: Queue,
  ) {}

  @Process()
  async handleStep(job: Job<{ runId: string; nodeId: string; dryRun?: boolean }>) {
    const { runId, nodeId, dryRun = false } = job.data;

    const run = await this.runRepo.findOne({ where: { id: runId }, relations: ['workflow'] });
    if (!run) return;

    if (run.status !== WorkflowRunStatus.RUNNING && run.status !== WorkflowRunStatus.FAILED) {
      return;
    }

    const complaint = await this.complaintRepo.findOneBy({ id: run.complaintId });
    if (!complaint) {
       await this.runRepo.update(runId, { status: WorkflowRunStatus.FAILED, error: 'Complaint not found' });
       return;
    }

    const def = run.workflow.definition;
    const node = def.nodes.find((n: any) => n.id === nodeId);
    if (!node) return;

    let log = await this.logRepo.findOne({ where: { runId, nodeId } });
    if (!log) {
      log = this.logRepo.create({
        runId,
        nodeId,
        nodeType: node.type,
        status: StepStatus.RUNNING,
        startedAt: new Date(),
        input: run.context,
      });
      await this.logRepo.save(log);
    } else {
      await this.logRepo.update(log.id, { status: StepStatus.RUNNING, startedAt: new Date() });
    }

    try {
      let actualType = node.type;
      if (actualType === 'action' && node.config?.actionType) {
        actualType = node.config.actionType;
      }

      const handler = this.handlers[actualType];
      if (!handler) throw new Error(`Unknown node type: ${actualType}`);

      const ctx: NodeHandlerContext = {
        runContext: run.context,
        complaint,
        config: node.config || {},
        dryRun,
        aiService: this.aiService,
        notificationsService: this.notificationsService,
        emailService: this.emailService,
        usersService: this.usersService,
        complaintRepo: this.complaintRepo,
      };

      const result: NodeHandlerResult = await handler(ctx);

      await this.logRepo.update(log.id, {
        status: result.skipped ? StepStatus.SKIPPED : StepStatus.COMPLETED,
        output: result.output as any,
        completedAt: new Date(),
      });

      if (result.output) {
        const updatedContext = { ...run.context, ...result.output };
        await this.runRepo.update(runId, { context: updatedContext as any });
        run.context = updatedContext;
      }

      let edges = def.edges.filter((e: any) => e.from === nodeId);

      if (node.type === 'condition' && result.conditionResult !== undefined) {
         const branch = result.conditionResult ? 'true' : 'false';
         edges = edges.filter((e: any) => e.condition === branch);
         const skippedEdges = def.edges.filter((e: any) => e.from === nodeId && e.condition !== branch);
         for (const se of skippedEdges) {
             await this.markBranchSkipped(runId, se.to, def);
         }
      }

      if (edges.length === 0) {
        await this.runRepo.update(runId, { status: WorkflowRunStatus.COMPLETED, completedAt: new Date() });
      } else {
        for (const edge of edges) {
          const delayOpts = result.delayMs ? { delay: result.delayMs } : {};
          await this.stepsQueue.add({
            runId,
            nodeId: edge.to,
            dryRun,
          }, delayOpts);
        }
      }

    } catch (err: any) {
      this.logger.error(`Workflow step failed: ${err.message}`, err.stack);
      await this.logRepo.update(log.id, {
        status: StepStatus.FAILED,
        error: err.message,
        completedAt: new Date(),
      });
      await this.runRepo.update(runId, { status: WorkflowRunStatus.FAILED, error: `Step ${nodeId} failed: ${err.message}` });
    }
  }

  private async markBranchSkipped(runId: string, startNodeId: string, def: any) {
    const stack = [startNodeId];
    const visited = new Set<string>();
    
    while(stack.length > 0) {
       const currId = stack.pop()!;
       if (visited.has(currId)) continue;
       visited.add(currId);
       
       const node = def.nodes.find((n:any) => n.id === currId);
       if (node) {
         await this.logRepo.save(this.logRepo.create({
            runId,
            nodeId: currId,
            nodeType: node.type,
            status: StepStatus.SKIPPED,
            skippedReason: 'Branch not taken',
         }));
       }
       
       const edges = def.edges.filter((e:any) => e.from === currId);
       for (const e of edges) stack.push(e.to);
    }
  }
}
