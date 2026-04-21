# Complaint Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a status update panel and two-lane comment thread (shared + internal) to the complaint detail page so committee members can act on complaints.

**Architecture:** New `CommentsModule` with a single `complaint_comments` table (isInternal flag, role-filtered at service layer). Status update extends the existing `PATCH /complaints/:id/status` endpoint. Emails fire via Bull queue using the existing `EmailService`.

**Tech Stack:** NestJS, TypeORM, Bull (job deduplication for debounce — no extra Redis dependency), React, TanStack Query v5, shadcn/ui, WebSocket (existing socket.io gateway)

**Spec:** `docs/superpowers/specs/2026-03-21-complaint-actions-design.md`

---

## Chunk 1: Backend — Comment Entity, DTO, Service

### Task 1: Comment entity

**Files:**
- Create: `ResolveIQ-Backend/src/modules/comments/comment.entity.ts`

- [ ] Create the file:

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { User } from '../users/entities/user.entity';

@Entity('complaint_comments')
@Index(['complaintId', 'isInternal', 'createdAt'])
@Index(['authorId'])
export class ComplaintComment extends BaseEntity {
  @Column()
  complaintId: string;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  isInternal: boolean;

  @Column({ type: 'varchar', nullable: true })
  authorRole?: string;
}
```

- [ ] Verify `BaseEntity` at `src/common/entities/base.entity.ts` includes `id`, `createdAt`, `updatedAt`, `deletedAt` — it does (same pattern as `Attachment`).

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/comments/comment.entity.ts
git commit -m "feat(comments): add ComplaintComment entity"
```

---

### Task 2: CreateCommentDto

**Files:**
- Create: `ResolveIQ-Backend/src/modules/comments/dto/create-comment.dto.ts`

- [ ] Create the file:

```typescript
import { IsString, MaxLength, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isInternal?: boolean;
}
```

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/comments/dto/create-comment.dto.ts
git commit -m "feat(comments): add CreateCommentDto"
```

---

### Task 3: CommentsService

**Files:**
- Create: `ResolveIQ-Backend/src/modules/comments/comments.service.ts`

Key logic:
- `findByComplaint`: role-based filter, paginated, includes soft-deleted (redacted), loads `author` relation
- `create`: ownership check → privilege check → committee check → closed check → save → emit WS → queue email
- `delete`: author or admin only, soft delete
- Email queueing: use `InjectQueue('comments-email')` (new queue); emit `complaint.comment.added` via EventEmitter2

- [ ] Create the file:

```typescript
import {
  Injectable, Logger, NotFoundException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComplaintComment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Complaint, ComplaintStatus } from '../complaints/entities/complaint.entity';

const PRIVILEGED = ['admin', 'manager', 'committee_member'];

export interface CommentAuthor {
  id: string;
  roles?: string[];
  committeeId?: string;
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(ComplaintComment)
    private readonly repo: Repository<ComplaintComment>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectQueue('comments-email')
    private readonly emailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private isPrivileged(roles: string[]): boolean {
    return roles.some(r => PRIVILEGED.includes(r));
  }

  async findByComplaint(
    complaintId: string,
    user: CommentAuthor,
    page = 1,
    limit = 20,
  ) {
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const privileged = this.isPrivileged(user.roles ?? []);
    if (!privileged && complaint.raisedById !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const qb = this.repo
      .createQueryBuilder('c')
      .withDeleted()
      .leftJoinAndSelect('c.author', 'author')
      .where('c.complaintId = :complaintId', { complaintId })
      .orderBy('c.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!privileged) {
      qb.andWhere('c.isInternal = false');
    }

    const [data, total] = await qb.getManyAndCount();

    // Redact soft-deleted
    const redacted = data.map(c => {
      if (c.deletedAt) {
        c.body = '[deleted]';
        c.authorId = null as any;
        c.authorRole = null as any;
        c.author = null as any;
      }
      return c;
    });

    return { data: redacted, total, page, limit };
  }

  async create(
    complaintId: string,
    dto: CreateCommentDto,
    user: CommentAuthor,
  ): Promise<ComplaintComment> {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['raisedBy'],
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const privileged = this.isPrivileged(user.roles ?? []);
    if (!privileged && complaint.raisedById !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (dto.isInternal && !privileged) {
      throw new ForbiddenException('Only privileged users can post internal notes');
    }
    // Committee member must belong to the complaint's committee
    if (
      user.roles?.includes('committee_member') &&
      !user.roles?.includes('admin') &&
      !user.roles?.includes('manager') &&
      complaint.committeeId &&
      user.committeeId !== complaint.committeeId
    ) {
      throw new ForbiddenException('You are not assigned to this complaint\'s committee');
    }
    if (complaint.status === ComplaintStatus.CLOSED) {
      throw new BadRequestException('Complaint is closed');
    }

    const primaryRole = (user.roles ?? []).find(r => PRIVILEGED.includes(r)) ?? 'employee';
    const comment = this.repo.create({
      complaintId,
      authorId: user.id,
      body: dto.body,
      isInternal: dto.isInternal ?? false,
      authorRole: primaryRole,
    });
    const saved = await this.repo.save(comment);

    // WebSocket — no isInternal in payload
    this.eventEmitter.emit('complaint.comment.added', { complaintId });

    // Email (fire-and-forget).
    // Use Bull jobId deduplication ONLY for complainant→committee emails (debounce 5-min window).
    // Committee→complainant emails are NOT debounced (every reply should reach the complainant).
    const authorIsPrivileged = this.isPrivileged(user.roles ?? []);
    const jobId = (!authorIsPrivileged && !saved.isInternal)
      ? `complainant-reply:${complaintId}:${Math.floor(Date.now() / 300_000)}`
      : undefined;
    this.emailQueue
      .add(
        'comment-notify',
        { complaintId, commentId: saved.id, isInternal: saved.isInternal, authorIsPrivileged },
        { jobId },
      )
      .catch(e => this.logger.error('Failed to queue comment email', e));

    return saved;
  }

  async delete(
    complaintId: string,
    commentId: string,
    user: CommentAuthor,
  ): Promise<void> {
    const comment = await this.repo.findOne({ where: { id: commentId, complaintId } });
    if (!comment) throw new NotFoundException('Comment not found');

    const isAdmin = user.roles?.includes('admin');
    if (!isAdmin && comment.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.repo.softDelete(commentId);
  }
}
```

- [ ] Run TypeScript check to verify service compiles:
```bash
cd ResolveIQ-Backend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/comments/comments.service.ts
git commit -m "feat(comments): add CommentsService with role-based filtering"
```

---

### Task 4: CommentsController

**Files:**
- Create: `ResolveIQ-Backend/src/modules/comments/comments.controller.ts`

- [ ] Create the file:

```typescript
import {
  Controller, Get, Post, Delete,
  Param, Body, Query, ParseUUIDPipe,
  ParseIntPipe, DefaultValuePipe, UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('complaints/:complaintId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @CurrentUser() user: { id: string; roles?: string[]; committeeId?: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.commentsService.findByComplaint(complaintId, user, page, limit);
  }

  @Post()
  create(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { id: string; roles?: string[]; committeeId?: string },
  ) {
    return this.commentsService.create(complaintId, dto, user);
  }

  @Delete(':commentId')
  delete(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    return this.commentsService.delete(complaintId, commentId, user);
  }
}
```

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/comments/comments.controller.ts
git commit -m "feat(comments): add CommentsController"
```

---

### Task 5a: Add `getMembersByCommitteeId` to `UsersService`

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/users/users.service.ts`

The `Committee` entity has no `members` relation. Users have a `committeeId` FK. Add a helper:

- [ ] Append to `UsersService`:

```typescript
async getMembersByCommitteeId(committeeId: string): Promise<User[]> {
  const all = await this.repo.find({ where: { committeeId, isActive: true } });
  return all.filter(u => u.roles.includes(UserRole.COMMITTEE_MEMBER));
}
```

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/users/users.service.ts
git commit -m "feat(users): add getMembersByCommitteeId helper"
```

---

### Task 5: Comment email processor

**Files:**
- Create: `ResolveIQ-Backend/src/modules/comments/comment-email.processor.ts`

This handles the `comments-email` Bull queue. For each job it:
1. Skips internal notes (never email)
2. For committee→complainant: email the complainant
3. For complainant→committee: Redis debounce (5-min TTL) then email committee + managers

- [ ] Create the file:

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { ComplaintComment } from './comment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { CommitteesService } from '../committees/committees.service';
import { UserRole } from '../users/entities/user.entity';

const PRIVILEGED = [UserRole.ADMIN, UserRole.MANAGER, UserRole.COMMITTEE_MEMBER];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Processor('comments-email')
export class CommentEmailProcessor {
  private readonly logger = new Logger(CommentEmailProcessor.name);

  constructor(
    @InjectRepository(ComplaintComment)
    private readonly commentRepo: Repository<ComplaintComment>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly committeesService: CommitteesService,
  ) {}

  @Process('comment-notify')
  async handleCommentNotify(job: Job<{ complaintId: string; commentId: string; isInternal: boolean; authorIsPrivileged: boolean }>) {
    const { complaintId, commentId, isInternal, authorIsPrivileged } = job.data;

    // Never email for internal notes
    if (isInternal) return;

    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) return;

    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['raisedBy'],
    });
    if (!complaint) return;

    if (authorIsPrivileged) {
      // Committee → complainant
      if (!complaint.raisedBy?.email) return;
      await this.emailService.sendEmail({
        to: complaint.raisedBy.email,
        subject: `Update on your complaint: ${esc(complaint.title)}`,
        html: `<p>Hi ${esc(complaint.raisedBy.fullName)},</p>
               <p>A team member has replied to your complaint <strong>${esc(complaint.title)}</strong>:</p>
               <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
                 ${esc(comment.body)}
               </blockquote>
               <p>Log in to view the full thread.</p>`,
      });
    } else {
      // Complainant → committee
      // Debounce is handled at the Bull job level via jobId in CommentsService.
      // If this job runs, the debounce window has passed — just send.
      // Committee has no members relation; users have committeeId FK — use getMembersByCommitteeId
      const recipients: string[] = [];
      if (complaint.committeeId) {
        const members = await this.usersService.getMembersByCommitteeId(complaint.committeeId);
        members.forEach(m => m.email && recipients.push(m.email));
        const committee = await this.committeesService.findById(complaint.committeeId);
        if (committee?.manager?.email) recipients.push(committee.manager.email);
      } else {
        const managers = await this.usersService.getManagers();
        managers.forEach(m => m.email && recipients.push(m.email));
      }

      for (const email of [...new Set(recipients)]) {
        await this.emailService.sendEmail({
          to: email,
          subject: `Complainant replied: ${esc(complaint.title)}`,
          html: `<p>The complainant has posted a new message on complaint <strong>${esc(complaint.title)}</strong>:</p>
                 <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
                   ${esc(comment.body)}
                 </blockquote>`,
        }).catch(e => this.logger.error(`Failed to send to ${email}: ${e}`));
      }
    }
  }
}
```

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/comments/comment-email.processor.ts
git commit -m "feat(comments): add comment email processor (Bull jobId deduplication)"
```

---

### Task 6: CommentsModule + registration

**Files:**
- Create: `ResolveIQ-Backend/src/modules/comments/comments.module.ts`
- Modify: `ResolveIQ-Backend/src/app.module.ts`

- [ ] Create `comments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ComplaintComment } from './comment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentEmailProcessor } from './comment-email.processor';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { CommitteesModule } from '../committees/committees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComplaintComment, Complaint]),
    BullModule.registerQueue({ name: 'comments-email' }),
    EmailModule,
    UsersModule,
    CommitteesModule,
  ],
  providers: [CommentsService, CommentEmailProcessor],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {}
```

- [ ] Open `src/app.module.ts`, add `CommentsModule` to the `imports` array (same pattern as `AttachmentsModule`).

- [ ] Run TypeScript check:
```bash
cd ResolveIQ-Backend && npx tsc --noEmit 2>&1
```
Expected: zero errors.

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/comments/comments.module.ts ResolveIQ-Backend/src/app.module.ts
git commit -m "feat(comments): register CommentsModule in app"
```

---

## Chunk 2: Backend — Status Update Patch + Status-Change Email

### Task 7: Patch `updateStatus` and add `sendStatusChangeEmail`

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.service.ts`
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.controller.ts`
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts`

**Step 1 — patch `ComplaintsService.updateStatus()`:**

In `complaints.service.ts`, replace the existing `updateStatus` method:

```typescript
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
```

- [ ] Apply the change.

**Step 2 — patch `ComplaintsController` `PATCH :id/status`:**

- [ ] Ensure `const PRIVILEGED_ROLES = ['admin', 'manager', 'committee_member'];` is defined at the top of `complaints.controller.ts` (it already exists on line 9 — no change needed).

Replace the existing `updateStatus` handler in `complaints.controller.ts`:

```typescript
@Patch(':id/status')
async updateStatus(
  @Param('id') id: string,
  @Body() body: { status: ComplaintStatus; resolutionNotes?: string; notifyComplainant?: boolean },
  @CurrentUser() user: { id: string; roles?: string[]; fullName?: string; email?: string },
) {
  const roles: string[] = user.roles ?? [];
  const isPrivileged = roles.some(r => PRIVILEGED_ROLES.includes(r));
  if (!isPrivileged) {
    throw new ForbiddenException('Only privileged users can update complaint status');
  }
  const autoNotify = body.status === ComplaintStatus.RESOLVED || body.status === ComplaintStatus.CLOSED;
  const notify = body.notifyComplainant ?? autoNotify;
  return this.complaintsService.updateStatus(id, body.status, body.resolutionNotes, notify, user);
}
```

- [ ] Apply the change. Add `ComplaintStatus` to the import if not already present.

**Step 3 — add `sendStatusChangeEmail` to `ComplaintNotifierService`:**

Append this method to `complaint-notifier.service.ts`:

```typescript
async sendStatusChangeEmail(
  complaint: Complaint,
  updatedBy?: { id?: string; fullName?: string; email?: string },
): Promise<void> {
  if (!complaint.raisedBy?.email) {
    this.logger.warn(`No email for complainant on complaint ${complaint.id}`);
    return;
  }
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const statusLabel = complaint.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const by = esc(updatedBy?.fullName ?? 'The team');
  await this.emailService.sendEmail({
    to: complaint.raisedBy.email,
    subject: `Your complaint status has been updated: ${statusLabel}`,
    html: `<p>Hi ${esc(complaint.raisedBy.fullName ?? '')},</p>
           <p>Your complaint <strong>${esc(complaint.title)}</strong> has been updated to <strong>${statusLabel}</strong> by ${by}.</p>
           ${complaint.resolutionNotes ? `<p><strong>Resolution notes:</strong><br>${esc(complaint.resolutionNotes)}</p>` : ''}
           <p>Log in to view the full details.</p>`,
  });
}
```

- [ ] Apply the change.

- [ ] Run TypeScript check:
```bash
cd ResolveIQ-Backend && npx tsc --noEmit 2>&1
```
Expected: zero errors.

- [ ] Commit:
```bash
git add ResolveIQ-Backend/src/modules/complaints/complaints.service.ts \
        ResolveIQ-Backend/src/modules/complaints/complaints.controller.ts \
        ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts
git commit -m "feat(complaints): role-guard status update, fix resolvedAt for closed, add sendStatusChangeEmail"
```

---

## Chunk 3: Frontend — Types, Hooks

### Task 8: Add `ApiComment` type

**Files:**
- Modify: `frontend/src/types/api.ts`

- [ ] Add to `api.ts`:

```typescript
export interface ApiComment {
  id: string;
  complaintId: string;
  authorId: string | null;
  author: { id: string; fullName: string; email: string } | null;
  body: string;
  isInternal: boolean;
  authorRole: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ApiCommentPage {
  data: ApiComment[];
  total: number;
  page: number;
  limit: number;
}
```

- [ ] Commit:
```bash
git add frontend/src/types/api.ts
git commit -m "feat(comments): add ApiComment and ApiCommentPage types"
```

---

### Task 9: Comment and status hooks

**Files:**
- Create: `frontend/src/hooks/useComments.ts`

- [ ] Create `useComments.ts`:

```typescript
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiComment, ApiCommentPage } from '@/types/api';

// useInfiniteQuery accumulates pages client-side — correct for "load more" pattern
export function useComments(complaintId: string) {
  return useInfiniteQuery<ApiCommentPage>({
    queryKey: ['comments', complaintId],
    queryFn: ({ pageParam = 1 }) =>
      apiClient
        .get(`/complaints/${complaintId}/comments?page=${pageParam}&limit=20`)
        .then(r => r.data),
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!complaintId,
  });
}

export function usePostComment(complaintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { body: string; isInternal?: boolean }) =>
      apiClient
        .post<ApiComment>(`/complaints/${complaintId}/comments`, data)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', complaintId] }),
  });
}

export function useDeleteComment(complaintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiClient
        .delete(`/complaints/${complaintId}/comments/${commentId}`)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', complaintId] }),
  });
}

export function useUpdateComplaintStatus(complaintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      status: string;
      resolutionNotes?: string;
      notifyComplainant?: boolean;
    }) =>
      apiClient
        .patch(`/complaints/${complaintId}/status`, data)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['complaints', complaintId] }),
  });
}
```

- [ ] Check how `apiClient` is imported in other hooks (e.g. `useAttachments.ts`) and mirror the same import path.

- [ ] Commit:
```bash
git add frontend/src/hooks/useComments.ts
git commit -m "feat(comments): add useComments, usePostComment, useDeleteComment, useUpdateComplaintStatus hooks"
```

---

## Chunk 4: Frontend — Components

### Task 10: CommentInput component

**Files:**
- Create: `frontend/src/components/cms/CommentInput.tsx`

- [ ] Create the file:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSubmit: (body: string) => void;
  isPending: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const MAX = 2000;

export function CommentInput({ onSubmit, isPending, disabled, disabledReason }: Props) {
  const [body, setBody] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={disabled ? disabledReason : 'Write a message…'}
          rows={3}
          maxLength={MAX}
          disabled={disabled || isPending}
          className="resize-none"
        />
        <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {body.length}/{MAX}
        </span>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={!body.trim() || isPending || disabled}
      >
        {isPending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}
```

- [ ] Commit:
```bash
git add frontend/src/components/cms/CommentInput.tsx
git commit -m "feat(comments): add CommentInput component"
```

---

### Task 11: CommentThread component

**Files:**
- Create: `frontend/src/components/cms/CommentThread.tsx`

- [ ] Create the file:

```tsx
import { useState, useEffect } from 'react';
import { useComments, usePostComment, useDeleteComment } from '@/hooks/useComments';
import { CommentInput } from './CommentInput';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiComment } from '@/types/api';

// Note: `useState` is used only for `activeTab` — `page` was removed in favour of useInfiniteQuery

const PRIVILEGED = ['admin', 'manager', 'committee_member'];

interface Props {
  complaintId: string;
  isClosed: boolean;
}

function CommentBubble({
  comment,
  currentUserId,
  isAdmin,
  onDelete,
}: {
  comment: ApiComment;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete: (id: string) => void;
}) {
  const isDeleted = !!comment.deletedAt;
  const canDelete = !isDeleted && (isAdmin || comment.authorId === currentUserId);

  return (
    <div
      className={`rounded-lg p-3 text-sm space-y-1 ${
        comment.isInternal
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-muted/40 border'
      }`}
    >
      {!isDeleted && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {comment.author?.fullName?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="font-medium text-foreground">{comment.author?.fullName ?? 'Unknown'}</span>
            {comment.authorRole && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                {comment.authorRole.replace('_', ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      <p
        className={`whitespace-pre-wrap leading-relaxed ${isDeleted ? 'text-muted-foreground italic' : 'text-foreground'}`}
      >
        {comment.body}
      </p>
    </div>
  );
}

export function CommentThread({ complaintId, isClosed }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'shared' | 'internal'>('shared');

  const privileged = PRIVILEGED.some(r => user?.roles?.includes(r));
  const isAdmin = user?.roles?.includes('admin');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useComments(complaintId);
  const postComment = usePostComment(complaintId);
  const deleteComment = useDeleteComment(complaintId);

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    const handler = ({ complaintId: cid }: { complaintId: string }) => {
      if (cid === complaintId) {
        qc.invalidateQueries({ queryKey: ['comments', complaintId] });
      }
    };
    socket.on('complaint.comment.added', handler);
    return () => { socket.off('complaint.comment.added', handler); };
  }, [complaintId, qc]);

  // Flatten all pages into a single array
  const allComments = data?.pages.flatMap(p => p.data) ?? [];
  const sharedComments = allComments.filter(c => !c.isInternal);
  const internalComments = allComments.filter(c => c.isInternal);
  const displayedComments = activeTab === 'internal' ? internalComments : sharedComments;

  const handleSubmit = (body: string) => {
    postComment.mutate(
      { body, isInternal: activeTab === 'internal' },
      { onError: () => toast.error('Failed to send message') },
    );
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId, {
      onError: () => toast.error('Failed to delete comment'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {privileged && (
        <div className="flex gap-1 border-b">
          {(['shared', 'internal'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'shared' ? 'Messages' : 'Internal Notes'}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {tab === 'shared' ? sharedComments.length : internalComments.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : displayedComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {activeTab === 'internal' ? 'No internal notes yet.' : 'No messages yet.'}
          </p>
        ) : (
          displayedComments.map(c => (
            <CommentBubble
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-xs text-muted-foreground underline"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}

      {/* Input */}
      <CommentInput
        onSubmit={handleSubmit}
        isPending={postComment.isPending}
        disabled={isClosed}
        disabledReason="Complaint is closed"
      />
    </div>
  );
}
```

- [ ] Commit:
```bash
git add frontend/src/components/cms/CommentThread.tsx
git commit -m "feat(comments): add CommentThread component with two-lane tabs and real-time updates"
```

---

### Task 12: StatusUpdatePanel component

**Files:**
- Create: `frontend/src/components/cms/StatusUpdatePanel.tsx`

- [ ] Create the file:

```tsx
import { useState, useEffect } from 'react';
import { useUpdateComplaintStatus } from '@/hooks/useComments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open:        ['assigned', 'in_progress', 'resolved', 'closed'],
  assigned:    ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved:    ['closed'],
  closed:      [],
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

interface Props {
  complaintId: string;
  currentStatus: string;
}

export function StatusUpdatePanel({ complaintId, currentStatus }: Props) {
  const updateStatus = useUpdateComplaintStatus(complaintId);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(false);

  const isFinal = (s: string) => s === 'resolved' || s === 'closed';

  useEffect(() => {
    setNotify(isFinal(status));
  }, [status]);

  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];
  const isClosed = currentStatus === 'closed';

  const handleSave = () => {
    if (!status) return;
    updateStatus.mutate(
      { status, resolutionNotes: notes || undefined, notifyComplainant: notify },
      {
        onSuccess: () => {
          toast.success('Status updated');
          setStatus('');
          setNotes('');
        },
        onError: () => toast.error('Failed to update status'),
      },
    );
  };

  if (isClosed) {
    return (
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">Status</h2>
        <p className="text-sm text-muted-foreground">This complaint is closed.</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Update Status</h2>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">New status</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {transitions.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
      </div>

      {(status === 'resolved' || status === 'closed') && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Resolution notes</label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe what was done…"
            rows={3}
            maxLength={2000}
          />
        </div>
      )}

      {status && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={e => setNotify(e.target.checked)}
            className="rounded"
          />
          Notify complainant by email
        </label>
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={!status || updateStatus.isPending}
        onClick={handleSave}
      >
        {updateStatus.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
```

- [ ] Commit:
```bash
git add frontend/src/components/cms/StatusUpdatePanel.tsx
git commit -m "feat(complaints): add StatusUpdatePanel component"
```

---

### Task 13: Wire into ComplaintDetail

**Files:**
- Modify: `frontend/src/pages/ComplaintDetail.tsx`

- [ ] Add imports at the top of `ComplaintDetail.tsx`:

```tsx
import { CommentThread } from '@/components/cms/CommentThread';
import { StatusUpdatePanel } from '@/components/cms/StatusUpdatePanel';
```

- [ ] In the main column (after the Description card, before Activity Timeline), add:

```tsx
<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-surface p-5">
  <h2 className="mb-4 text-sm font-semibold text-foreground">Discussion</h2>
  <CommentThread
    complaintId={complaint.id}
    isClosed={complaint.status === 'closed'}
  />
</motion.div>
```

- [ ] In the right sidebar (before `AIActionPanel`), add (for privileged users only):

```tsx
{(isAdmin || user?.roles?.some(r => ['manager', 'committee_member'].includes(r))) && (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
    <StatusUpdatePanel
      complaintId={complaint.id}
      currentStatus={complaint.status}
    />
  </motion.div>
)}
```

- [ ] Run TypeScript check:
```bash
cd frontend && npx tsc --noEmit 2>&1
```
Expected: zero errors.

- [ ] Commit:
```bash
git add frontend/src/pages/ComplaintDetail.tsx
git commit -m "feat(complaints): wire CommentThread and StatusUpdatePanel into ComplaintDetail"
```

---

## Chunk 5: Verification

### Task 14: End-to-end smoke test

- [ ] Start backend: `cd ResolveIQ-Backend && npm run start:dev`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Log in as a **complainant**, open a complaint → verify:
  - Discussion section visible, Messages tab only (no Internal Notes tab)
  - Can post a message
  - StatusUpdatePanel not visible
- [ ] Log in as a **committee member**, open same complaint → verify:
  - Both Messages and Internal Notes tabs visible
  - Can post to both lanes
  - Internal notes show amber background
  - StatusUpdatePanel visible in sidebar
  - Can change status from Open → In Progress → Resolved with notes
  - "Notify complainant" checkbox auto-checked for Resolved
- [ ] Check backend logs — no TypeScript errors, no unhandled exceptions
- [ ] Confirm complaint status update triggers email (check SMTP logs or Mailtrap)

- [ ] Final commit:
```bash
git add -A
git commit -m "feat(complaints): complete complaint actions feature — status panel + comment thread"
```
