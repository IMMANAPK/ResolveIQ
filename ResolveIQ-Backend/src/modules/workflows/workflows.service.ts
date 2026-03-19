import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowStepLog } from './entities/workflow-step-log.entity';

const CURRENT_SCHEMA_VERSION = 1;

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(WorkflowDefinition)
    private readonly repo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowRun)
    private readonly runRepo: Repository<WorkflowRun>,
    @InjectRepository(WorkflowStepLog)
    private readonly logRepo: Repository<WorkflowStepLog>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string) {
    const wf = await this.repo.findOneBy({ id });
    if (!wf) throw new NotFoundException(`Workflow ${id} not found`);
    return wf;
  }

  async create(data: Partial<WorkflowDefinition>) {
    this.validateDefinition(data);
    const triggerNode = data.definition?.nodes.find((n: any) => n.type === 'trigger');
    const trigger = triggerNode?.config?.event 
      ? { type: 'event' as const, event: triggerNode.config.event } 
      : { type: 'manual' as const };
    
    const wf = this.repo.create({ ...data, trigger, definitionVersion: 1 });
    return this.repo.save(wf);
  }

  async update(id: string, data: Partial<WorkflowDefinition>) {
    const wf = await this.findById(id);
    if (data.definition) {
      this.validateDefinition(data);
      const triggerNode = data.definition.nodes.find((n: any) => n.type === 'trigger');
      data.trigger = triggerNode?.config?.event 
        ? { type: 'event' as const, event: triggerNode.config.event } 
        : { type: 'manual' as const };
      data.definitionVersion = wf.definitionVersion + 1;
    }
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    return this.repo.delete(id);
  }

  /** GET /admin/workflows/runs/:runId — single run with its step logs */
  async findRunById(runId: string) {
    const run = await this.runRepo.findOne({
      where: { id: runId },
      relations: ['workflow'],
    });
    if (!run) throw new NotFoundException(`WorkflowRun ${runId} not found`);
    const steps = await this.logRepo.find({
      where: { runId },
      order: { createdAt: 'ASC' },
    });
    return { ...run, steps };
  }

  /** Query runs by complaintId (for ComplaintDetail page) */
  async findRunsByComplaintId(complaintId: string) {
    const runs = await this.runRepo.find({
      where: { complaintId },
      order: { createdAt: 'DESC' },
      relations: ['workflow'],
    });
    // Attach step logs to each run
    return Promise.all(
      runs.map(async (run) => {
        const steps = await this.logRepo.find({
          where: { runId: run.id },
          order: { createdAt: 'ASC' },
        });
        return { ...run, steps };
      }),
    );
  }

  validateDefinition(data: Partial<WorkflowDefinition>) {
    const def = data.definition;
    if (!def) throw new BadRequestException('Workflow definition is required');
    if (def.schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new BadRequestException(`Schema version ${def.schemaVersion} not supported (max ${CURRENT_SCHEMA_VERSION})`);
    }

    const nodes: any[] = def.nodes || [];
    const edges: any[] = def.edges || [];

    const triggers = nodes.filter(n => n.type === 'trigger');
    if (triggers.length !== 1) {
      throw new BadRequestException('Workflow must have exactly one trigger node');
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        throw new BadRequestException(`Invalid edge connecting ${edge.from} to ${edge.to}`);
      }
    }

    for (const node of nodes) {
      if (node.type === 'condition') {
        const outgoing = edges.filter(e => e.from === node.id);
        if (outgoing.length !== 2) {
          throw new BadRequestException(`Condition node ${node.id} must have exactly 2 outgoing edges (true/false)`);
        }
        if (!outgoing.some(e => e.condition === 'true') || !outgoing.some(e => e.condition === 'false')) {
          throw new BadRequestException(`Condition node ${node.id} must explicitly route "true" and "false" conditions`);
        }
      }
    }

    // Graph cycle check
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodeIds.forEach(id => { inDegree[id] = 0; adj[id] = []; });
    edges.forEach(e => {
      adj[e.from].push(e.to);
      inDegree[e.to]++;
    });
    
    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    let visitedCount = 0;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      visitedCount++;
      for (const next of adj[curr]) {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      }
    }
    if (visitedCount !== nodeIds.size) {
      throw new BadRequestException('Workflow definition contains circular references (cycles are not allowed)');
    }

    let maxDelayMins = 0;
    for (const node of nodes) {
      if (node.type === 'delay') {
        maxDelayMins += Number(node.config?.minutes || 0);
      }
    }
    const totalDelaySecs = maxDelayMins * 60;
    if (totalDelaySecs > (data.maxRunDurationSeconds ?? 300)) {
       throw new BadRequestException(`Total possible delay (${totalDelaySecs}s) exceeds maxRunDurationSeconds`);
    }
  }
}
