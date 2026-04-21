# AI Workflow Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-phase AI automation system — async complaint summary, smart routing with notification rules, and a drag-and-drop workflow builder.

**Architecture:** Phase 1 adds a bull queue that generates AI summaries for complaints asynchronously. Phase 2 adds a second queue for routing + configurable notification rules. Phase 3 adds a workflow engine with JSON definitions executed via bull, and a ReactFlow canvas for visual editing. Each phase builds on the previous.

**Tech Stack:** NestJS, TypeORM, bull v4 via @nestjs/bull, Groq SDK, React, @xyflow/react, React Query, Socket.io

**Spec:** `docs/superpowers/specs/2026-03-18-ai-workflow-builder-design.md`

---

## File Structure

### Phase 1 — AI Summary
```
Backend:
  Modify: src/modules/complaints/entities/complaint.entity.ts     — add 5 AI summary columns
  Create: src/modules/ai/ai-summary.processor.ts                  — bull worker for ai-summary queue
  Modify: src/modules/ai/ai.service.ts                            — add generateSummary() method
  Modify: src/modules/ai/ai.module.ts                             — register ai-summary queue, import processor
  Modify: src/modules/complaints/complaints.service.ts             — push summary job on create
  Modify: src/modules/complaints/complaints.module.ts              — import AiModule for queue access
  Modify: src/modules/complaints/complaints.controller.ts          — add POST regenerate-summary endpoint
  Modify: src/modules/gateway/events.gateway.ts                    — add emitSummaryUpdated()

Frontend:
  Modify: frontend/src/types/api.ts                                — add summary fields to ApiComplaint
  Modify: frontend/src/hooks/useComplaints.ts                      — add useRegenerateSummary mutation
  Modify: frontend/src/pages/ComplaintDetail.tsx                   — render summary card with status states
```

### Phase 2 — Routing + Notification Rules
```
Backend:
  Create: src/modules/notifications/entities/notification-rule.entity.ts  — NotificationRule entity
  Create: src/modules/complaints/complaint-routing.processor.ts           — bull worker for routing queue
  Create: src/modules/notifications/notification-rules.service.ts         — CRUD + rule evaluation
  Create: src/modules/notifications/notification-rules.controller.ts      — admin CRUD endpoints
  Modify: src/modules/complaints/entities/complaint.entity.ts             — add routing + notification columns
  Modify: src/modules/ai/ai.service.ts                                    — add routeComplaintWithConfidence(), remove old routeComplaint()
  Modify: src/modules/complaints/complaints.module.ts                     — register complaint-routing queue
  Modify: src/modules/complaints/complaint-notifier.service.ts            — remove inline routing logic
  Modify: src/modules/notifications/notifications.module.ts               — export NotificationRulesService

Frontend:
  Modify: frontend/src/types/api.ts                                       — add NotificationRule types
  Create: frontend/src/hooks/useNotificationRules.ts                      — CRUD hooks
  Modify: frontend/src/pages/CommitteeSettings.tsx                        — add notification rules section
```

### Phase 3 — Workflow Builder
```
Backend:
  Create: src/modules/workflows/entities/workflow-definition.entity.ts
  Create: src/modules/workflows/entities/workflow-run.entity.ts
  Create: src/modules/workflows/entities/workflow-step-log.entity.ts
  Create: src/modules/workflows/workflows.module.ts
  Create: src/modules/workflows/workflows.service.ts                      — CRUD + schema validation
  Create: src/modules/workflows/workflows.controller.ts                   — admin API
  Create: src/modules/workflows/workflow-engine.service.ts                — triggerByEvent, triggerManual
  Create: src/modules/workflows/workflow-step.processor.ts                — bull worker, node handler dispatch
  Create: src/modules/workflows/node-handlers/index.ts                    — handler registry
  Create: src/modules/workflows/node-handlers/trigger.handler.ts
  Create: src/modules/workflows/node-handlers/ai-prompt.handler.ts
  Create: src/modules/workflows/node-handlers/condition.handler.ts
  Create: src/modules/workflows/node-handlers/send-notification.handler.ts
  Create: src/modules/workflows/node-handlers/send-email.handler.ts
  Create: src/modules/workflows/node-handlers/update-complaint.handler.ts
  Create: src/modules/workflows/node-handlers/delay.handler.ts
  Create: src/modules/workflows/workflow-timeout.service.ts               — @Cron job for timed_out runs
  Modify: src/app.module.ts                                               — import WorkflowsModule

Frontend:
  Modify: frontend/src/types/api.ts                                       — workflow types
  Create: frontend/src/hooks/useWorkflows.ts                              — CRUD + run hooks
  Create: frontend/src/pages/WorkflowList.tsx                             — list page
  Create: frontend/src/pages/WorkflowBuilder.tsx                          — ReactFlow canvas
  Create: frontend/src/components/workflows/NodePalette.tsx               — drag source sidebar
  Create: frontend/src/components/workflows/NodeConfigPanel.tsx           — right panel config form
  Create: frontend/src/components/workflows/RunHistory.tsx                — run list + step timeline
  Create: frontend/src/components/workflows/custom-nodes/TriggerNode.tsx
  Create: frontend/src/components/workflows/custom-nodes/AiPromptNode.tsx
  Create: frontend/src/components/workflows/custom-nodes/ConditionNode.tsx
  Create: frontend/src/components/workflows/custom-nodes/ActionNode.tsx
  Modify: frontend/src/App.tsx                                            — add workflow routes
  Modify: frontend/src/components/cms/AppSidebar.tsx                      — add Workflows nav item
  Modify: frontend/src/pages/ComplaintDetail.tsx                          — add Workflow Runs section
```

---

## Chunk 1: Phase 1 — Async AI Summary

### Task 1: Add AI Summary Columns to Complaint Entity

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/complaints/entities/complaint.entity.ts`

- [ ] **Step 1: Add the AiSummaryStatus enum and new columns**

```typescript
// Add enum before the Complaint class
export enum AiSummaryStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Add these columns to the Complaint entity class:
@Column({ type: 'text', nullable: true })
aiSummary?: string;

@Column({ type: 'enum', enum: AiSummaryStatus, nullable: true })
aiSummaryStatus?: AiSummaryStatus;

@Column({ type: 'timestamp', nullable: true })
aiSummaryRequestedAt?: Date;

@Column({ type: 'timestamp', nullable: true })
aiSummaryCompletedAt?: Date;

@Column({ type: 'text', nullable: true })
aiSummaryError?: string;
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`
Expected: No errors. TypeORM synchronize will auto-create columns on restart.

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/complaints/entities/complaint.entity.ts
git commit -m "feat(entity): add AI summary columns to Complaint entity"
```

---

### Task 2: Add generateSummary() to AiService

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/ai/ai.service.ts`

- [ ] **Step 1: Add the generateSummary method**

Add below the existing `routeComplaint()` method:

```typescript
async generateSummary(complaint: {
  title: string;
  description: string;
  category: string;
  priority: string;
}): Promise<string> {
  const prompt = `You are a complaint summarizer. Generate a concise 2-3 sentence summary of this complaint for internal review.

Title: ${complaint.title}
Category: ${complaint.category}
Priority: ${complaint.priority}
Description: ${complaint.description}

Respond with ONLY the summary text, no labels or formatting.`;

  const response = await this.groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.3,
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (!summary) throw new Error('AI returned empty summary');
  return summary;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/ai/ai.service.ts
git commit -m "feat(ai): add generateSummary method to AiService"
```

---

### Task 3: Create AiSummaryProcessor (Bull Worker)

**Files:**
- Create: `ResolveIQ-Backend/src/modules/ai/ai-summary.processor.ts`

- [ ] **Step 1: Create the processor file**

Reference the existing pattern from `escalation.processor.ts`. The processor:
1. Calls `AiService.generateSummary()`
2. Updates the complaint entity with result
3. Pushes a job to the `complaint-routing` queue (Phase 2 — for now, just log a placeholder)
4. Emits WebSocket event via `EventsGateway`

```typescript
import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint, AiSummaryStatus } from '../complaints/entities/complaint.entity';
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

      await this.complaintRepo.update(complaintId, {
        aiSummary: summary,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryCompletedAt: new Date(),
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
```

- [ ] **Step 2: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`
Expected: Will fail — `emitSummaryUpdated` and `complaint-routing` queue not yet registered. That's OK, we add them next.

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/ai/ai-summary.processor.ts
git commit -m "feat(ai): create AiSummaryProcessor bull worker"
```

---

### Task 4: Add WebSocket Event to EventsGateway

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/gateway/events.gateway.ts`

- [ ] **Step 1: Add emitSummaryUpdated method**

Add to the `EventsGateway` class:

```typescript
emitSummaryUpdated(complaintId: string) {
  this.server.to(`complaint:${complaintId}`).emit('complaint.summary.updated', { complaintId });
}
```

- [ ] **Step 2: Commit**

```bash
git add ResolveIQ-Backend/src/modules/gateway/events.gateway.ts
git commit -m "feat(gateway): add emitSummaryUpdated WebSocket event"
```

---

### Task 5: Register Queues and Wire Up Modules

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/ai/ai.module.ts`
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.module.ts`

- [ ] **Step 1: Update AiModule**

Register both queues and import required modules:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiSummaryProcessor } from './ai-summary.processor';
import { CommitteesModule } from '../committees/committees.module';
import { GatewayModule } from '../gateway/gateway.module';
import { Complaint } from '../complaints/entities/complaint.entity';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-summary' }),
    BullModule.registerQueue({ name: 'complaint-routing' }),
    TypeOrmModule.forFeature([Complaint]),
    CommitteesModule,
    GatewayModule,
  ],
  providers: [AiService, AiSummaryProcessor],
  exports: [AiService, BullModule],
})
export class AiModule {}
```

- [ ] **Step 2: Update ComplaintsModule**

Add `AiModule` import so `ComplaintsService` can inject the `ai-summary` queue:

```typescript
// In complaints.module.ts imports array, add:
import { AiModule } from '../ai/ai.module';

// Add AiModule to the imports array (alongside existing imports)
```

- [ ] **Step 3: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add ResolveIQ-Backend/src/modules/ai/ai.module.ts ResolveIQ-Backend/src/modules/complaints/complaints.module.ts
git commit -m "feat(modules): register ai-summary and complaint-routing queues"
```

---

### Task 6: Push Summary Job on Complaint Creation

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.service.ts`

- [ ] **Step 1: Inject the ai-summary queue and update createAndNotify**

```typescript
// Add imports:
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AiSummaryStatus } from './entities/complaint.entity';

// Add to constructor:
@InjectQueue('ai-summary') private readonly aiSummaryQueue: Queue,

// Modify createAndNotify() method:
async createAndNotify(data: /* existing type */) {
  const complaint = await this.create({
    ...data,
    aiSummaryStatus: AiSummaryStatus.PENDING,
    aiSummaryRequestedAt: new Date(),
  });

  // Replace the existing async notifier.notifyCommittee() call
  // with a queue job push instead:
  await this.aiSummaryQueue.add(
    { complaintId: complaint.id },
    { timeout: 30000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  );

  return complaint;
}
```

- [ ] **Step 2: Remove the existing notifier.notifyCommittee() call in createAndNotify**

The old async call `this.notifier.notifyCommittee(complaint).catch(...)` is replaced by the queue job push above.

- [ ] **Step 3: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add ResolveIQ-Backend/src/modules/complaints/complaints.service.ts
git commit -m "feat(complaints): push AI summary job on complaint creation"
```

---

### Task 7: Add Regenerate Summary Endpoint

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.controller.ts`
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.service.ts`

- [ ] **Step 1: Add regenerateSummary method to ComplaintsService**

```typescript
async regenerateSummary(id: string): Promise<void> {
  const complaint = await this.findById(id);
  if (!complaint) throw new NotFoundException('Complaint not found');

  await this.complaintRepo.update(id, {
    aiSummaryStatus: AiSummaryStatus.PENDING,
    aiSummaryRequestedAt: new Date(),
    aiSummaryError: null,
    aiSummary: null,
  });

  await this.aiSummaryQueue.add(
    { complaintId: id },
    { timeout: 30000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  );
}
```

- [ ] **Step 2: Add endpoint to ComplaintsController**

```typescript
@Post(':id/regenerate-summary')
@Roles(UserRole.ADMIN, UserRole.COMMITTEE_MEMBER)
async regenerateSummary(@Param('id') id: string) {
  await this.complaintsService.regenerateSummary(id);
  return { message: 'Summary regeneration queued' };
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add ResolveIQ-Backend/src/modules/complaints/complaints.controller.ts ResolveIQ-Backend/src/modules/complaints/complaints.service.ts
git commit -m "feat(complaints): add POST regenerate-summary endpoint"
```

---

### Task 8: Frontend — Update Types and Hooks

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/hooks/useComplaints.ts`

- [ ] **Step 1: Add summary fields to ApiComplaint type**

```typescript
// In the ApiComplaint interface, add:
aiSummary?: string;
aiSummaryStatus?: 'pending' | 'completed' | 'failed';
aiSummaryError?: string;
```

- [ ] **Step 2: Add useRegenerateSummary hook**

```typescript
// In useComplaints.ts, add:
export function useRegenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/complaints/${id}/regenerate-summary`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['complaint', id] });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/hooks/useComplaints.ts
git commit -m "feat(frontend): add AI summary types and regenerate hook"
```

---

### Task 9: Frontend — Render AI Summary Card on ComplaintDetail

**Files:**
- Modify: `frontend/src/pages/ComplaintDetail.tsx`

- [ ] **Step 1: Add summary card component and WebSocket listener**

Add an `AiSummaryCard` component inside the file (or inline in the JSX):

```tsx
// Import at top:
import { useRegenerateSummary } from "@/hooks/useComplaints";
import { Loader2, RefreshCw, Brain } from "lucide-react";

// Add inside the component, subscribe to WebSocket:
const regenerate = useRegenerateSummary();

useEffect(() => {
  if (!complaint?.id) return;
  socket.emit('join:complaint', complaint.id); // joins complaint:{id} room
  const handler = () => {
    queryClient.invalidateQueries({ queryKey: ['complaint', complaint.id] });
  };
  socket.on('complaint.summary.updated', handler);
  return () => { socket.off('complaint.summary.updated', handler); };
}, [complaint?.id]);

// Render the summary card in the complaint detail layout:
{/* AI Summary Card */}
{complaint.aiSummaryStatus === 'completed' && complaint.aiSummary && (
  <div className="rounded-lg border bg-blue-50/50 p-4 space-y-1">
    <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
      <Brain className="h-4 w-4" />
      AI Summary
    </div>
    <p className="text-sm text-gray-700">{complaint.aiSummary}</p>
  </div>
)}
{(complaint.aiSummaryStatus === 'pending' || (!complaint.aiSummaryStatus && complaint.aiSummary === undefined)) && (
  <div className="rounded-lg border bg-muted/50 p-4 flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Generating AI summary…
  </div>
)}
{complaint.aiSummaryStatus === 'failed' && (
  <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between">
    <span className="text-sm text-muted-foreground">Summary unavailable</span>
    <Button
      size="sm"
      variant="ghost"
      onClick={() => regenerate.mutate(complaint.id)}
      disabled={regenerate.isPending}
    >
      <RefreshCw className="h-3.5 w-3.5 mr-1" />
      Regenerate
    </Button>
  </div>
)}
```

- [ ] **Step 2: Test in browser**

1. Start backend (`npm run start:dev`)
2. Start frontend (`npm run dev`)
3. Create a new complaint
4. Verify: summary appears on detail page after ~2-5s

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ComplaintDetail.tsx
git commit -m "feat(frontend): render AI summary card with WebSocket live update"
```

---

## Chunk 2: Phase 2 — Async Routing + Notification Rules

### Task 10: Add Routing Columns to Complaint Entity

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/complaints/entities/complaint.entity.ts`

- [ ] **Step 1: Add routing and notification columns**

```typescript
// Add enums:
export enum RoutingMethod {
  AI = 'ai',
  CATEGORY = 'category',
  MANUAL = 'manual',
}

// Add columns to Complaint class:
@Column({ nullable: true })
committeeId?: string;

@ManyToOne(() => Committee, { nullable: true, eager: false })
@JoinColumn({ name: 'committeeId' })
committee?: Committee;

@Column({ type: 'enum', enum: RoutingMethod, nullable: true })
routingMethod?: RoutingMethod;

@Column({ type: 'float', nullable: true })
routingConfidence?: number;

@Column({ type: 'text', nullable: true })
routingReason?: string;

@Column({ type: 'jsonb', nullable: true })
routingRawAiResponse?: Record<string, unknown>;

@Column({ type: 'timestamp', nullable: true })
notificationSentAt?: Date;
```

Import `Committee` and `JoinColumn` at top.

- [ ] **Step 2: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/complaints/entities/complaint.entity.ts
git commit -m "feat(entity): add routing and notification columns to Complaint"
```

---

### Task 11: Create NotificationRule Entity

**Files:**
- Create: `ResolveIQ-Backend/src/modules/notifications/entities/notification-rule.entity.ts`

- [ ] **Step 1: Create the entity**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Committee } from '../../committees/entities/committee.entity';

export enum NotificationRuleType {
  DEFAULT = 'default',
  CONDITIONAL = 'conditional',
}

export interface RuleCondition {
  field: 'priority' | 'category';
  op: 'eq' | 'neq';
  value: string;
}

@Entity('notification_rules')
export class NotificationRule extends BaseEntity {
  @Column()
  committeeId: string;

  @ManyToOne(() => Committee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'committeeId' })
  committee: Committee;

  @Column({ type: 'enum', enum: NotificationRuleType })
  type: NotificationRuleType;

  @Column({ type: 'jsonb', nullable: true })
  condition?: RuleCondition;

  @Column({ type: 'simple-array', default: '' })
  recipientUserIds: string[];

  @Column({ type: 'simple-array', default: '' })
  recipientRoles: string[];

  @Column({ type: 'int', default: 0 })
  order: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add ResolveIQ-Backend/src/modules/notifications/entities/notification-rule.entity.ts
git commit -m "feat(entity): create NotificationRule entity"
```

---

### Task 12: Add routeComplaintWithConfidence to AiService

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/ai/ai.service.ts`

- [ ] **Step 1: Add the new routing method**

Replace the existing `routeComplaint()` with `routeComplaintWithConfidence()`:

```typescript
async routeComplaintWithConfidence(complaint: {
  title: string;
  description: string;
  aiSummary?: string;
}): Promise<{ committee: string; confidence: number; reason: string }> {
  const committees = await this.committeesService.getCommitteesForAi();
  if (committees.length === 0) {
    return { committee: 'General Committee', confidence: 0, reason: 'No committees configured' };
  }

  const committeeList = committees
    .map((c) => `- ${c.name}: ${c.description || 'No description'} (categories: ${c.categories.join(', ') || 'none'})`)
    .join('\n');

  const summaryContext = complaint.aiSummary ? `\nAI Summary: ${complaint.aiSummary}` : '';

  const prompt = `You are a complaint routing assistant. Route this complaint to the most appropriate committee.

Available Committees:
${committeeList}

Complaint Title: ${complaint.title}
Complaint Description: ${complaint.description}${summaryContext}

Respond in JSON format ONLY:
{"committee": "Committee Name", "confidence": 0.0-1.0, "reason": "one sentence explanation"}`;

  const response = await this.groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  try {
    const parsed = JSON.parse(text);
    return {
      committee: parsed.committee ?? 'General Committee',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reason: parsed.reason ?? 'AI routing',
    };
  } catch {
    return { committee: 'General Committee', confidence: 0, reason: 'Failed to parse AI response' };
  }
}
```

- [ ] **Step 2: Remove the old routeComplaint() method**

Delete the existing `routeComplaint()` method entirely. Update any remaining callers (in `complaint-notifier.service.ts`) in Task 15.

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/ai/ai.service.ts
git commit -m "feat(ai): replace routeComplaint with routeComplaintWithConfidence"
```

---

### Task 13: Create NotificationRulesService

**Files:**
- Create: `ResolveIQ-Backend/src/modules/notifications/notification-rules.service.ts`

- [ ] **Step 1: Create the service with CRUD + evaluation logic**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationRule, RuleCondition } from './entities/notification-rule.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationRulesService {
  constructor(
    @InjectRepository(NotificationRule)
    private readonly ruleRepo: Repository<NotificationRule>,
    private readonly usersService: UsersService,
  ) {}

  findByCommittee(committeeId: string) {
    return this.ruleRepo.find({ where: { committeeId }, order: { order: 'ASC' } });
  }

  create(data: Partial<NotificationRule>) {
    return this.ruleRepo.save(this.ruleRepo.create(data));
  }

  async update(id: string, data: Partial<NotificationRule>) {
    await this.ruleRepo.update(id, data);
    return this.ruleRepo.findOneBy({ id });
  }

  remove(id: string) {
    return this.ruleRepo.delete(id);
  }

  /** Evaluate rules against a complaint and return deduplicated recipient user IDs */
  async resolveRecipients(
    committeeId: string,
    complaint: { priority: string; category: string },
  ): Promise<string[]> {
    const rules = await this.findByCommittee(committeeId);
    const userIdSet = new Set<string>();

    for (const rule of rules) {
      if (rule.type === 'conditional' && rule.condition) {
        if (!this.matchesCondition(rule.condition, complaint)) continue;
      }
      rule.recipientUserIds.forEach((id) => userIdSet.add(id));

      // Expand roles to user IDs
      if (rule.recipientRoles.length > 0) {
        const users = await this.usersService.findAll();
        for (const user of users) {
          if (user.roles.some((r) => rule.recipientRoles.includes(r))) {
            userIdSet.add(user.id);
          }
        }
      }
    }

    return Array.from(userIdSet);
  }

  private matchesCondition(
    condition: RuleCondition,
    complaint: { priority: string; category: string },
  ): boolean {
    const fieldValue = complaint[condition.field];
    if (condition.op === 'eq') return fieldValue === condition.value;
    if (condition.op === 'neq') return fieldValue !== condition.value;
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add ResolveIQ-Backend/src/modules/notifications/notification-rules.service.ts
git commit -m "feat(notifications): create NotificationRulesService with rule evaluation"
```

---

### Task 14: Create NotificationRulesController + Update Module

**Files:**
- Create: `ResolveIQ-Backend/src/modules/notifications/notification-rules.controller.ts`
- Modify: `ResolveIQ-Backend/src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Create the controller**

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { NotificationRulesService } from './notification-rules.service';

@Controller('committees/:committeeId/notification-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationRulesController {
  constructor(private readonly rulesService: NotificationRulesService) {}

  @Get()
  findAll(@Param('committeeId') committeeId: string) {
    return this.rulesService.findByCommittee(committeeId);
  }

  @Post()
  create(@Param('committeeId') committeeId: string, @Body() body: any) {
    return this.rulesService.create({ ...body, committeeId });
  }

  @Patch(':ruleId')
  update(@Param('ruleId') ruleId: string, @Body() body: any) {
    return this.rulesService.update(ruleId, body);
  }

  @Delete(':ruleId')
  remove(@Param('ruleId') ruleId: string) {
    return this.rulesService.remove(ruleId);
  }
}
```

- [ ] **Step 2: Update NotificationsModule**

Add `TypeOrmModule.forFeature([NotificationRule])`, `NotificationRulesService`, `NotificationRulesController`, and import `UsersModule`.

- [ ] **Step 3: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add ResolveIQ-Backend/src/modules/notifications/notification-rules.controller.ts ResolveIQ-Backend/src/modules/notifications/notifications.module.ts
git commit -m "feat(notifications): add NotificationRules CRUD controller and module wiring"
```

---

### Task 15: Create ComplaintRoutingProcessor + Remove Old Routing

**Files:**
- Create: `ResolveIQ-Backend/src/modules/complaints/complaint-routing.processor.ts`
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts`

- [ ] **Step 1: Create the routing processor**

```typescript
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
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
      routingRawAiResponse: rawResponse,
    });

    // Step 4: Resolve notification recipients and send
    // NOTE: ComplaintNotifierService.sendNotificationToRecipients() is currently private
    // with a different signature. As part of this task, refactor it to be public with this
    // new signature, or add a new public method sendToRecipientIds() that accepts
    // { complaint, recipientUserIds: string[], includeAiSummary: boolean }.
    // The existing private method takes { complaint, recipients: User[], type, messagePrefix }
    // — the new method should resolve User[] from recipientUserIds internally.
    if (committeeId && !complaint.notificationSentAt) {
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
      }

      await this.complaintRepo.update(complaintId, { notificationSentAt: new Date() });
    }

    this.logger.log(`Routed complaint ${complaintId} to committee ${committeeId ?? 'NONE'} via ${routingMethod}`);
  }
}
```

- [ ] **Step 2: Refactor ComplaintNotifierService**

In `complaint-notifier.service.ts`:

1. **Add a new public method** `sendToRecipientIds()` that accepts `{ complaint, recipientUserIds: string[], includeAiSummary: boolean }`. It should resolve `User[]` from the IDs via `UsersService.findByIds()`, then send in-app notifications + emails (including AI summary in email body if `includeAiSummary` is true).

2. **Simplify `notifyCommittee()`** to only work with a pre-resolved `committeeId` from the complaint record. Remove the calls to `committeesService.findByCategory()` and `aiService.routeComplaint()` inside it. This method now becomes a thin wrapper or can be marked deprecated since Phase 2 handles notification sending.

3. **Update `notifyManagers()`** to read `complaint.committeeId` instead of resolving inline.

- [ ] **Step 3: Register ComplaintRoutingProcessor in ComplaintsModule**

Add `ComplaintRoutingProcessor` to the `providers` array. Import `NotificationsModule` for `NotificationRulesService`.

- [ ] **Step 4: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add ResolveIQ-Backend/src/modules/complaints/complaint-routing.processor.ts ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts ResolveIQ-Backend/src/modules/complaints/complaints.module.ts
git commit -m "feat(routing): create ComplaintRoutingProcessor, remove inline routing from notifier"
```

---

### Task 16: Frontend — Notification Rules UI in Committee Settings

**Files:**
- Modify: `frontend/src/types/api.ts`
- Create: `frontend/src/hooks/useNotificationRules.ts`
- Modify: `frontend/src/pages/CommitteeSettings.tsx`

- [ ] **Step 1: Add types**

```typescript
// In api.ts:
export interface ApiNotificationRule {
  id: string;
  committeeId: string;
  type: 'default' | 'conditional';
  condition?: { field: 'priority' | 'category'; op: 'eq' | 'neq'; value: string };
  recipientUserIds: string[];
  recipientRoles: string[];
  order: number;
}
```

- [ ] **Step 2: Create hooks**

```typescript
// useNotificationRules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiNotificationRule } from '@/types/api';

export function useNotificationRules(committeeId: string) {
  return useQuery({
    queryKey: ['notification-rules', committeeId],
    queryFn: () => api.get<ApiNotificationRule[]>(`/committees/${committeeId}/notification-rules`).then(r => r.data),
    enabled: !!committeeId,
  });
}

export function useCreateNotificationRule(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ApiNotificationRule>) =>
      api.post(`/committees/${committeeId}/notification-rules`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-rules', committeeId] }),
  });
}

export function useUpdateNotificationRule(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, ...data }: { ruleId: string } & Partial<ApiNotificationRule>) =>
      api.patch(`/committees/${committeeId}/notification-rules/${ruleId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-rules', committeeId] }),
  });
}

export function useDeleteNotificationRule(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      api.delete(`/committees/${committeeId}/notification-rules/${ruleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-rules', committeeId] }),
  });
}
```

- [ ] **Step 3: Add notification rules section to CommitteeSettings page**

Inside each committee card in `CommitteeSettings.tsx`, add an expandable section that:
- Lists existing notification rules (default + conditional)
- Has an "Add Rule" button that opens a dialog with: type selector, condition builder (field/op/value dropdowns), recipient multi-select
- Allows delete and reorder via drag handles

This is a UI implementation task — follow existing patterns from the committee CRUD dialog. Use the `useNotificationRules`, `useCreateNotificationRule`, and `useDeleteNotificationRule` hooks.

- [ ] **Step 4: Test in browser**

1. Navigate to `/settings/committees`
2. Click a committee → see notification rules section
3. Add a default rule with recipients
4. Add a conditional rule (e.g., priority = high → notify managers)
5. Verify rules persist on refresh

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/hooks/useNotificationRules.ts frontend/src/pages/CommitteeSettings.tsx
git commit -m "feat(frontend): add notification rules UI to Committee Settings"
```

---

## Chunk 3: Phase 3 Backend — Workflow Entities + Engine

### Task 17: Create Workflow Entities

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/entities/workflow-definition.entity.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/entities/workflow-run.entity.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/entities/workflow-step-log.entity.ts`

- [ ] **Step 1: Create WorkflowDefinition entity**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('workflow_definitions')
export class WorkflowDefinition extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb' })
  trigger: { type: 'event' | 'manual'; event?: string };

  @Column({ type: 'jsonb' })
  definition: { schemaVersion: number; nodes: any[]; edges: any[] };

  @Column({ type: 'int', default: 1 })
  schemaVersion: number;

  @Column({ type: 'int', default: 1 })
  definitionVersion: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'int', default: 300 })
  maxRunDurationSeconds: number;

  @Column({ nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;
}
```

- [ ] **Step 2: Create WorkflowRun entity**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WorkflowDefinition } from './workflow-definition.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';

export enum WorkflowRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

export enum WorkflowTriggeredBy {
  EVENT = 'event',
  MANUAL = 'manual',
}

@Entity('workflow_runs')
export class WorkflowRun extends BaseEntity {
  @Column()
  workflowId: string;

  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'workflowId' })
  workflow: WorkflowDefinition;

  @Column({ type: 'int' })
  definitionVersion: number;

  @Column()
  complaintId: string;

  @ManyToOne(() => Complaint)
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'enum', enum: WorkflowRunStatus, default: WorkflowRunStatus.RUNNING })
  status: WorkflowRunStatus;

  @Column({ type: 'enum', enum: WorkflowTriggeredBy })
  triggeredBy: WorkflowTriggeredBy;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  error?: string;
}
```

- [ ] **Step 3: Create WorkflowStepLog entity**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WorkflowRun } from './workflow-run.entity';

export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('workflow_step_logs')
export class WorkflowStepLog extends BaseEntity {
  @Column()
  runId: string;

  @ManyToOne(() => WorkflowRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runId' })
  run: WorkflowRun;

  @Column()
  nodeId: string;

  @Column()
  nodeType: string;

  @Column({ type: 'enum', enum: StepStatus, default: StepStatus.PENDING })
  status: StepStatus;

  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  output?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  skippedReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  retryPolicy?: { maxAttempts: number; backoffMs: number };

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  error?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/entities/
git commit -m "feat(workflows): create WorkflowDefinition, WorkflowRun, WorkflowStepLog entities"
```

---

### Task 18: Create WorkflowsService (CRUD + Validation)

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/workflows.service.ts`

- [ ] **Step 1: Create the service**

Implements: `findAll()`, `findById()`, `create()`, `update()`, `remove()`, `validateDefinition()`.

The `validateDefinition()` method checks:
- `schemaVersion` does not exceed the current supported max constant (e.g., `CURRENT_SCHEMA_VERSION = 1`)
- Exactly one trigger node
- All edge from/to reference valid node IDs
- Condition nodes have exactly 2 outgoing edges (true/false)
- No cycles (topological sort / DFS)
- Sum of delay minutes * 60 ≤ maxRunDurationSeconds
- Syncs trigger column from trigger node config

On save, increments `definitionVersion`.

- [ ] **Step 2: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/workflows.service.ts
git commit -m "feat(workflows): create WorkflowsService with CRUD and schema validation"
```

---

### Task 19: Create WorkflowsController

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/workflows.controller.ts`

- [ ] **Step 1: Create admin-only CRUD controller**

Endpoints following the spec API surface:
- `GET /admin/workflows` — list all
- `POST /admin/workflows` — create (validates definition)
- `GET /admin/workflows/:id` — get by ID
- `PATCH /admin/workflows/:id` — update (validates, increments version)
- `DELETE /admin/workflows/:id` — delete
- `POST /admin/workflows/:id/run` — manual trigger
- `POST /admin/workflows/:id/dry-run` — dry-run
- `GET /admin/workflows/:id/runs` — run history for workflow
- `GET /admin/workflow-runs/:runId` — single run detail (separate controller or route prefix)

All endpoints guarded with `@Roles(UserRole.ADMIN)`.

- [ ] **Step 2: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/workflows.controller.ts
git commit -m "feat(workflows): create admin WorkflowsController"
```

---

### Task 20: Create Node Handlers

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/index.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/trigger.handler.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/ai-prompt.handler.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/condition.handler.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/send-notification.handler.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/send-email.handler.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/update-complaint.handler.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/node-handlers/delay.handler.ts`

- [ ] **Step 1: Create handler interface and registry**

```typescript
// index.ts
export interface NodeHandlerContext {
  runContext: Record<string, unknown>;
  complaint: Complaint;
  config: Record<string, unknown>;
  dryRun: boolean;
}

export interface NodeHandlerResult {
  output?: Record<string, unknown>;
  conditionResult?: boolean; // only for condition nodes
  delayMs?: number;         // only for delay nodes
  skipped?: boolean;
}

export type NodeHandler = (ctx: NodeHandlerContext) => Promise<NodeHandlerResult>;
```

- [ ] **Step 2: Implement each handler**

Each handler is a simple function. Key handlers:
- `trigger`: no-op, returns empty output
- `ai-prompt`: calls `AiService` with the configured prompt slug, writes output to context
- `condition`: evaluates field (from context or complaint) against op/value, returns conditionResult
- `send-notification`: calls `NotificationsService.create()` for recipients (skipped in dry-run)
- `send-email`: calls `EmailService` (skipped in dry-run)
- `update-complaint`: updates complaint field via TypeORM (skipped in dry-run)
- `delay`: returns `delayMs: config.minutes * 60 * 1000` — processor uses this for delayed job

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/node-handlers/
git commit -m "feat(workflows): create node handler functions for all 7 node types"
```

---

### Task 21: Create WorkflowEngineService + StepProcessor

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/workflow-engine.service.ts`
- Create: `ResolveIQ-Backend/src/modules/workflows/workflow-step.processor.ts`

- [ ] **Step 1: Create WorkflowEngineService**

```typescript
// Key methods:
async triggerByEvent(event: string, complaintId: string): Promise<WorkflowRun[]>
  // Query: WorkflowDefinition where trigger.event = event AND isActive
  // For each: create WorkflowRun, push first node job to 'workflow-steps' queue

async triggerManual(workflowId: string, complaintId: string): Promise<WorkflowRun>
  // Same but single workflow, triggeredBy = MANUAL

async dryRun(workflowId: string, complaintId: string): Promise<WorkflowStepLog[]>
  // Like triggerManual but passes dryRun: true through jobs
```

- [ ] **Step 2: Create WorkflowStepProcessor**

```typescript
@Processor('workflow-steps')
export class WorkflowStepProcessor {
  @Process()
  async handleStep(job: Job<{
    runId: string;
    nodeId: string;
    dryRun?: boolean;
  }>) {
    // 1. Load WorkflowRun + definition
    // 2. Find/create WorkflowStepLog
    // 3. Get node config from definition
    // 4. Dispatch to handler by nodeType
    // 5. Merge output into run context
    // 6. Resolve outgoing edges
    // 7. For condition: mark un-taken branch as skipped
    // 8. Push next node jobs (or mark run completed)
    // 9. For delay nodes: use bull delayed job option
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/workflow-engine.service.ts ResolveIQ-Backend/src/modules/workflows/workflow-step.processor.ts
git commit -m "feat(workflows): create WorkflowEngineService and WorkflowStepProcessor"
```

---

### Task 22: Create WorkflowTimeoutService

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/workflow-timeout.service.ts`

- [ ] **Step 1: Create the cron service**

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { WorkflowRun, WorkflowRunStatus } from './entities/workflow-run.entity';
import { WorkflowDefinition } from './entities/workflow-definition.entity';

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
```

- [ ] **Step 2: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/workflow-timeout.service.ts
git commit -m "feat(workflows): create WorkflowTimeoutService cron for timed_out runs"
```

---

### Task 23: Install @nestjs/event-emitter + Create WorkflowsModule + Register in AppModule

**Files:**
- Create: `ResolveIQ-Backend/src/modules/workflows/workflows.module.ts`
- Modify: `ResolveIQ-Backend/src/app.module.ts`

- [ ] **Step 1: Install @nestjs/event-emitter**

Run: `cd ResolveIQ-Backend && npm install @nestjs/event-emitter`

- [ ] **Step 2: Create WorkflowsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowStepLog } from './entities/workflow-step-log.entity';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowStepProcessor } from './workflow-step.processor';
import { WorkflowTimeoutService } from './workflow-timeout.service';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { ComplaintsModule } from '../complaints/complaints.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowDefinition, WorkflowRun, WorkflowStepLog]),
    BullModule.registerQueue({ name: 'workflow-steps' }),
    AiModule,
    NotificationsModule,
    EmailModule,
    ComplaintsModule,
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    WorkflowEngineService,
    WorkflowStepProcessor,
    WorkflowTimeoutService,
  ],
  exports: [WorkflowEngineService],
})
export class WorkflowsModule {}
```

- [ ] **Step 3: Add EventEmitterModule + WorkflowsModule to AppModule**

```typescript
// In app.module.ts, add imports:
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkflowsModule } from './modules/workflows/workflows.module';
// Add both to the imports array:
// EventEmitterModule.forRoot(),
// WorkflowsModule,
```

- [ ] **Step 4: Add event emission to ComplaintsService**

In `complaints.service.ts`, inject `EventEmitter2` and emit events after complaint operations:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

// In constructor:
private readonly eventEmitter: EventEmitter2,

// After complaint creation (in createAndNotify or equivalent):
this.eventEmitter.emit('complaint.created', { complaintId: complaint.id });

// After status changes:
this.eventEmitter.emit('complaint.status_changed', { complaintId: complaint.id, newStatus });
```

- [ ] **Step 5: Add event listener in WorkflowEngineService**

In `workflow-engine.service.ts`, add `@OnEvent` decorators to listen for complaint events and trigger matching workflows:

```typescript
import { OnEvent } from '@nestjs/event-emitter';

@OnEvent('complaint.created')
async onComplaintCreated(payload: { complaintId: string }) {
  await this.triggerByEvent('complaint.created', payload.complaintId);
}

@OnEvent('complaint.status_changed')
async onStatusChanged(payload: { complaintId: string }) {
  await this.triggerByEvent('complaint.status_changed', payload.complaintId);
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd ResolveIQ-Backend && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add ResolveIQ-Backend/package.json ResolveIQ-Backend/package-lock.json ResolveIQ-Backend/src/modules/workflows/workflows.module.ts ResolveIQ-Backend/src/app.module.ts ResolveIQ-Backend/src/modules/complaints/complaints.service.ts ResolveIQ-Backend/src/modules/workflows/workflow-engine.service.ts
git commit -m "feat(workflows): create WorkflowsModule, register EventEmitter, wire up event-based triggers"
```

---

## Chunk 4: Phase 3 Frontend — Workflow Builder Canvas

### Task 24: Install @xyflow/react + Add Types

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: Install ReactFlow**

Run: `cd frontend && npm install @xyflow/react`

- [ ] **Step 2: Add workflow types to api.ts**

```typescript
export interface ApiWorkflowNode {
  id: string;
  type: 'trigger' | 'ai_prompt' | 'condition' | 'send_notification' | 'send_email' | 'update_complaint' | 'delay';
  config: Record<string, unknown>;
  position?: { x: number; y: number }; // for ReactFlow canvas positioning
}

export interface ApiWorkflowEdge {
  from: string;
  to: string;
  condition?: 'true' | 'false';
}

export interface ApiWorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: { type: 'event' | 'manual'; event?: string };
  definition: { schemaVersion: number; nodes: ApiWorkflowNode[]; edges: ApiWorkflowEdge[] };
  schemaVersion: number;
  definitionVersion: number;
  isActive: boolean;
  maxRunDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export type ApiWorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export interface ApiWorkflowRun {
  id: string;
  workflowId: string;
  definitionVersion: number;
  complaintId: string;
  status: ApiWorkflowRunStatus;
  triggeredBy: 'event' | 'manual';
  context: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ApiWorkflowStepLog {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  skippedReason?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/api.ts
git commit -m "feat(frontend): install @xyflow/react and add workflow types"
```

---

### Task 25: Create Workflow Hooks

**Files:**
- Create: `frontend/src/hooks/useWorkflows.ts`

- [ ] **Step 1: Create CRUD + run hooks**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiWorkflowDefinition, ApiWorkflowRun, ApiWorkflowStepLog } from '@/types/api';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<ApiWorkflowDefinition[]>('/admin/workflows').then(r => r.data),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api.get<ApiWorkflowDefinition>(`/admin/workflows/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ApiWorkflowDefinition>) =>
      api.post<ApiWorkflowDefinition>('/admin/workflows', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ApiWorkflowDefinition>) =>
      api.patch<ApiWorkflowDefinition>(`/admin/workflows/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', vars.id] });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/workflows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useRunWorkflow() {
  return useMutation({
    mutationFn: ({ id, complaintId }: { id: string; complaintId: string }) =>
      api.post<ApiWorkflowRun>(`/admin/workflows/${id}/run`, { complaintId }).then(r => r.data),
  });
}

export function useDryRunWorkflow() {
  return useMutation({
    mutationFn: ({ id, complaintId }: { id: string; complaintId: string }) =>
      api.post<ApiWorkflowStepLog[]>(`/admin/workflows/${id}/dry-run`, { complaintId }).then(r => r.data),
  });
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: () => api.get<ApiWorkflowRun[]>(`/admin/workflows/${workflowId}/runs`).then(r => r.data),
    enabled: !!workflowId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useWorkflows.ts
git commit -m "feat(frontend): create workflow CRUD and run hooks"
```

---

### Task 26: Create WorkflowList Page

**Files:**
- Create: `frontend/src/pages/WorkflowList.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/cms/AppSidebar.tsx`

- [ ] **Step 1: Create the list page**

Table with columns: name, trigger event, version, last run status, last run time, active toggle. "New Workflow" button that navigates to `/admin/workflows/new`.

Follow the existing table patterns from `CommitteeSettings.tsx` or admin pages.

- [ ] **Step 2: Add route to App.tsx**

```tsx
import WorkflowList from "./pages/WorkflowList";
import WorkflowBuilder from "./pages/WorkflowBuilder";

// Inside the CMS routes:
<Route path="/admin/workflows" element={<AdminRoute><WorkflowList /></AdminRoute>} />
<Route path="/admin/workflows/:id" element={<AdminRoute><WorkflowBuilder /></AdminRoute>} />
```

- [ ] **Step 3: Add sidebar nav item**

In `AppSidebar.tsx`, add to admin nav items:
```typescript
{ title: "Workflows", url: "/admin/workflows", icon: GitBranch },
```
Import `GitBranch` from `lucide-react`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/WorkflowList.tsx frontend/src/App.tsx frontend/src/components/cms/AppSidebar.tsx
git commit -m "feat(frontend): create WorkflowList page with routing and nav"
```

---

### Task 27a: Create Custom Node Components

**Files:**
- Create: `frontend/src/components/workflows/custom-nodes/TriggerNode.tsx`
- Create: `frontend/src/components/workflows/custom-nodes/AiPromptNode.tsx`
- Create: `frontend/src/components/workflows/custom-nodes/ConditionNode.tsx`
- Create: `frontend/src/components/workflows/custom-nodes/ActionNode.tsx`

- [ ] **Step 1: Create custom node components**

Each custom node renders as a styled card with colored border matching the node type. Uses `@xyflow/react` `Handle` components for source/target ports.

- `TriggerNode`: blue border, shows event name, single output handle
- `AiPromptNode`: purple border, shows prompt slug + output var, input + output handles
- `ConditionNode`: yellow border, shows condition field/op/value, input + two output handles (true/false labeled)
- `ActionNode`: green/orange/red border depending on action type (`send_notification`, `send_email`, `update_complaint`), input handle + output handle

Note: `position` is stored inside the `definition` JSON as `{ x, y }` on each node object — this is a frontend-only extension the backend should tolerate (extra fields in node objects pass validation).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/workflows/custom-nodes/
git commit -m "feat(frontend): create custom ReactFlow node components"
```

---

### Task 27b: Create NodePalette + NodeConfigPanel

**Files:**
- Create: `frontend/src/components/workflows/NodePalette.tsx`
- Create: `frontend/src/components/workflows/NodeConfigPanel.tsx`

- [ ] **Step 1: Create NodePalette sidebar**

A sidebar listing draggable node types. Each type has an icon, label, and uses `onDragStart` to set `event.dataTransfer` with the node type for drop-on-canvas.

- [ ] **Step 2: Create NodeConfigPanel**

Right-side panel that appears when a node is selected. Shows a form with the node's config fields:
- Trigger: event name dropdown (`complaint.created`, `complaint.status_changed`, `complaint.escalated`)
- AI Prompt: prompt slug input, output variable name
- Condition: field (with namespace hint — plain for context, `complaint.fieldName` for DB), operator (`eq`, `neq`, `gt`, `lt`, `contains`), value
- Notification/Email: recipient picker, message/subject/body
- Update Complaint: field dropdown, value input
- Delay: minutes input

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workflows/NodePalette.tsx frontend/src/components/workflows/NodeConfigPanel.tsx
git commit -m "feat(frontend): create NodePalette and NodeConfigPanel components"
```

---

### Task 27c: Create RunHistory Component

**Files:**
- Create: `frontend/src/components/workflows/RunHistory.tsx`

- [ ] **Step 1: Create RunHistory tab component**

Lists `WorkflowRun` records with expandable step logs. Each step shows: node type icon, status badge, duration, and collapsible input/output JSON preview. Uses `useWorkflowRuns(workflowId)` hook.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/workflows/RunHistory.tsx
git commit -m "feat(frontend): create RunHistory component"
```

---

### Task 27d: Assemble WorkflowBuilder Page

**Files:**
- Create: `frontend/src/pages/WorkflowBuilder.tsx`

- [ ] **Step 1: Create WorkflowBuilder page**

Main page layout:
- Top bar: workflow name input, Save button (calls `useUpdateWorkflow`), Active toggle, Dry Run button
- Left: `NodePalette`
- Center: `@xyflow/react` `ReactFlow` canvas with custom node types registered, `onConnect` for edges, `onDrop` for node creation from palette
- Right: `NodeConfigPanel` (shown when node selected)
- Bottom tab: "Run History" tab

Converts between the spec's `{ nodes, edges }` JSON format and ReactFlow's internal node/edge format (which includes positions). Store `position` in each node object inside the `definition` JSON so layout persists.

- [ ] **Step 2: Test the canvas**

1. Navigate to `/admin/workflows/new`
2. Drag a trigger node onto canvas
3. Drag an AI prompt node, connect them
4. Add a condition node with branching
5. Save and verify the JSON is stored correctly
6. Test dry-run button

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/WorkflowBuilder.tsx
git commit -m "feat(frontend): create WorkflowBuilder canvas page with ReactFlow"
```

---

### Task 28: Add Workflow Runs Section to ComplaintDetail

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/workflows/workflows.controller.ts` — add `GET /complaints/:id/workflow-runs`
- Modify: `frontend/src/hooks/useWorkflows.ts` — add `useComplaintWorkflowRuns(complaintId)` hook
- Modify: `frontend/src/pages/ComplaintDetail.tsx`

- [ ] **Step 1: Add complaint-scoped workflow runs endpoint**

In `WorkflowsController`, add a non-admin endpoint:

```typescript
@Get('/complaints/:id/workflow-runs')
@UseGuards(JwtAuthGuard)
async getComplaintWorkflowRuns(@Param('id') complaintId: string) {
  return this.workflowsService.findRunsByComplaintId(complaintId);
}
```

Add the corresponding `findRunsByComplaintId(complaintId: string)` method in `WorkflowsService` that queries `WorkflowRun` where `complaintId` matches, with step logs relation.

- [ ] **Step 2: Add frontend hook**

```typescript
// In useWorkflows.ts
export function useComplaintWorkflowRuns(complaintId: string) {
  return useQuery({
    queryKey: ['complaint-workflow-runs', complaintId],
    queryFn: () => api.get<ApiWorkflowRun[]>(`/complaints/${complaintId}/workflow-runs`).then(r => r.data),
    enabled: !!complaintId,
  });
}
```

- [ ] **Step 3: Add workflow runs section to ComplaintDetail**

Render an expandable section below the existing complaint info showing:
- Each workflow run: workflow name, status badge, duration
- Expandable step timeline per run

- [ ] **Step 4: Commit**

```bash
git add ResolveIQ-Backend/src/modules/workflows/workflows.controller.ts ResolveIQ-Backend/src/modules/workflows/workflows.service.ts frontend/src/hooks/useWorkflows.ts frontend/src/pages/ComplaintDetail.tsx
git commit -m "feat: add Workflow Runs section to ComplaintDetail with complaint-scoped endpoint"
```

---

### Task 29: End-to-End Integration Test

- [ ] **Step 1: Test Phase 1 flow**

1. Start Redis, PostgreSQL, backend, frontend
2. Create a complaint via the UI
3. Verify AI summary appears on detail page within ~5 seconds
4. Check DB: `aiSummaryStatus = 'completed'`

- [ ] **Step 2: Test Phase 2 flow**

1. Verify complaint is routed to a committee (check `committeeId`, `routingMethod`)
2. Verify notification email is sent to committee members
3. Add a notification rule via Committee Settings
4. Create another complaint — verify rule applies

- [ ] **Step 3: Test Phase 3 flow**

1. Create a workflow: trigger(complaint.created) → ai_prompt → condition(priority=high) → send_notification
2. Activate it
3. Create a complaint with high priority
4. Verify workflow run appears in complaint detail with step logs

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete AI Workflow Builder (Phase 1-3)"
```
