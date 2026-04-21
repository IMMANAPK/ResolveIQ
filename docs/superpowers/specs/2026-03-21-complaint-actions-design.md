# Complaint Actions: Status Update Panel + Comment Thread

**Date:** 2026-03-21
**Status:** Approved
**Branch:** feature/complaint-actions

---

## Problem

Committee members receive complaint notification emails but have no meaningful actions available on the complaint detail page — only a read-only view. The core workflow (triage → respond → resolve) is broken.

---

## Goals

1. Committee members can update complaint status with resolution notes and optionally notify the complainant.
2. Two-lane comment thread: shared messages (committee ↔ complainant) and internal notes (committee-only).
3. Email notifications triggered on status change and new shared comments — without spam.

---

## Data Model

### `complaint_comments` table

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() | PK |
| `complaintId` | uuid | no | — | FK → complaints ON DELETE CASCADE |
| `authorId` | uuid | no | — | FK → users |
| `body` | text | no | — | max 2000 chars, enforced in DTO |
| `isInternal` | boolean | no | false | true = internal note |
| `authorRole` | varchar | yes | — | snapshot of author's primary role at post time (for audit/UI) |
| `createdAt` | timestamptz | no | now() | |
| `updatedAt` | timestamptz | no | now() | |
| `deletedAt` | timestamptz | yes | null | soft delete |

**Indexes:**
```sql
CREATE INDEX idx_comments_complaint_internal_created
  ON complaint_comments(complaintId, isInternal, createdAt);
CREATE INDEX idx_comments_author
  ON complaint_comments(authorId);
```

### `complaints` table — no new columns

Status update reuses existing: `status`, `resolutionNotes`, `resolvedAt`.

Note: `updateStatus` in `ComplaintsService` will be patched to also set `resolvedAt` when status is `closed` (currently only set for `resolved`).

---

## Backend

### Module: `src/modules/comments/`

Files:
- `comment.entity.ts`
- `dto/create-comment.dto.ts`
- `comments.service.ts`
- `comments.controller.ts`
- `comments.module.ts`

### DTO: `CreateCommentDto`

```typescript
export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isInternal?: boolean; // default false
}
```

### Endpoints

| Method | Route | Guard | Notes |
|---|---|---|---|
| `GET` | `/complaints/:id/comments` | JwtAuthGuard | filtered by role; complainant can only see own complaint |
| `POST` | `/complaints/:id/comments` | JwtAuthGuard | isInternal restricted to privileged roles |
| `DELETE` | `/complaints/:id/comments/:commentId` | JwtAuthGuard | author or admin only |

### Access Control (service layer)

**Privileged roles:** `admin`, `manager`, `committee_member`

**On GET `/complaints/:id/comments`:**
1. Load complaint — throw `NotFoundException` if not found
2. If not privileged AND `complaint.raisedById !== userId` → throw `ForbiddenException` (random employees cannot see other people's complaints)
3. If not privileged (i.e. the complainant) → add `WHERE isInternal = false`
4. If privileged → no filter, all comments returned

**On POST `/complaints/:id/comments`:**
1. Load complaint — throw `NotFoundException` if not found
2. If not privileged AND `complaint.raisedById !== userId` → throw `ForbiddenException`
3. If `isInternal = true` AND not privileged → throw `ForbiddenException`
4. If privileged (committee_member) → verify `complaint.committeeId === user.committeeId` OR user is `admin`/`manager` — throw `ForbiddenException` if mismatch
5. If complaint status is `closed` → throw `BadRequestException('Complaint is closed')`
6. Snapshot `authorRole` from the posting user's primary role
7. Save comment, emit WebSocket event, trigger email (fire-and-forget via Bull)

**On DELETE `/complaints/:id/comments/:commentId`:**
1. Load comment — throw `NotFoundException` if not found
2. If `comment.authorId !== userId` AND not admin → throw `ForbiddenException`
3. Soft delete

### Status Update — patch existing PATCH

```
PATCH /api/v1/complaints/:id
Body: { status?, resolutionNotes?, notifyComplainant?: boolean }
```

**Add explicit role guard in `ComplaintsService.update()`:**
- Only `admin`, `manager`, `committee_member` may change `status` or `resolutionNotes`
- Complainant calling this endpoint gets `ForbiddenException` if they try to change `status`
- `resolvedAt` set when status is `resolved` OR `closed` (fix existing gap)
- `notifyComplainant` defaults to `true` when status is `resolved` or `closed`, `false` otherwise
- If `notifyComplainant = true` → call `ComplaintNotifierService.sendStatusChangeEmail(complaint, updatedBy)`

### Email Triggers (Bull queue, fire-and-forget)

| Event | Recipients | Template |
|---|---|---|
| Status changed + notifyComplainant=true | complainant | "Your complaint status changed to [status]" |
| New shared comment by committee member | complainant | "A team member replied to your complaint" |
| New shared comment by complainant | committee members of complaint's committee + managers with access | "Complainant replied: [complaint title]" |

**Managers receive complainant-reply notifications** (they oversee the committee and need visibility).

**Spam prevention via Redis:**
- Key: `email:debounce:complainant-reply:{complaintId}` with TTL 5 minutes
- Before sending committee notification for complainant comment: check Redis key existence; if present, skip email; if absent, set key and send
- Redis TTL approach is safe across multiple Bull workers (no in-memory state)

### WebSocket

Emit `complaint.comment.added` with `{ complaintId }` only — **do NOT include `isInternal`** in the payload to avoid leaking the existence of internal notes to complainant subscribers. Frontend invalidates both tabs' queries on receive; server-side filtering handles what each role actually sees.

### Soft-delete response shape

When returning soft-deleted comments (included via TypeORM `withDeleted()`), the service must redact before serializing:
```typescript
if (comment.deletedAt) {
  comment.body = '[deleted]';
  comment.authorId = null;
  comment.authorRole = null;
  // keep id, complaintId, createdAt for thread continuity
}
```

---

## Frontend

### New Components

#### `StatusUpdatePanel.tsx`
- Visible only to `committee_member`, `manager`, `admin`
- Status dropdown showing valid next transitions from current status
- Resolution notes textarea (shown when status = resolved/closed)
- "Notify complainant" checkbox — auto-checked for resolved/closed, unchecked otherwise
- Save button → `useUpdateComplaintStatus` mutation
- Disabled when complaint is `closed`
- Placement: right sidebar, above `AIActionPanel`

#### `CommentThread.tsx`
- Tabs: **Messages** | **Internal Notes** — Internal Notes tab hidden for complainants
- Each comment: avatar initial, author name, role badge, timestamp, body
- Internal notes: subtle amber/yellow background to distinguish from shared
- Soft-deleted comments render `[deleted]` with muted styling — no author shown
- Paginated: "Load more" button (page size 20)
- Subscribes to `complaint.comment.added` WebSocket event → invalidates comments query

#### `CommentInput.tsx`
- Textarea (max 2000 chars) + character counter + submit button
- For privileged users: active tab determines `isInternal` sent to API
- Complainants: no tab UI, always `isInternal=false`
- Disabled + tooltip "Complaint is closed" when status = `closed`

### New Hooks

| Hook | Purpose |
|---|---|
| `useComments(complaintId, page?)` | GET paginated comments — server enforces visibility, client does not pass `isInternal` as filter |
| `usePostComment(complaintId)` | POST mutation, invalidates comments query |
| `useDeleteComment(complaintId)` | DELETE mutation, invalidates comments query |
| `useUpdateComplaintStatus(complaintId)` | PATCH mutation, invalidates complaint query |

Note: `isInternal` is **not** a query parameter on `useComments` — the server returns the correctly filtered set for the authenticated user. The two tabs on `CommentThread` are a UI-only concept that filters the already-returned list client-side by `isInternal` flag (privileged users get both; the complainant's response never contains `isInternal=true` rows).

### Placement in `ComplaintDetail.tsx`

```
Main column (lg:col-span-2):
  - AI Summary
  - Description
  - CommentThread        ← NEW (below description)
  - Activity Timeline
  - Workflow Runs
  - Feedback

Right sidebar:
  - Recipient Tracking
  - StatusUpdatePanel    ← NEW (above AIActionPanel, committee/admin only)
  - AIActionPanel
```

---

## Security Summary

| Concern | Mitigation |
|---|---|
| Complainant sees internal notes | Service adds `isInternal=false` filter; server never returns internal rows to non-privileged users |
| Random employee accesses another's complaint comments | Service checks `raisedById === userId` for non-privileged users; throws 403 otherwise |
| Non-privileged posts internal note | Service throws `ForbiddenException` if `isInternal=true` and not privileged |
| Committee member comments on wrong committee's complaint | Service checks `complaint.committeeId === user.committeeId` (admins/managers exempt) |
| Complainant changes status | `ComplaintsService.update()` explicitly checks roles before allowing status/resolutionNotes change |
| WebSocket leaks isInternal existence | Event payload contains only `complaintId`, no `isInternal` field |
| XSS in comment body | Body stored as plain text, rendered with `whitespace-pre-wrap`, never as `innerHTML` |
| Soft-delete leaks body/author | Service redacts `body`, `authorId`, `authorRole` before serializing deleted comments |
| Email spam (complainant replies) | Redis debounce key with 5-min TTL per complaint; safe across multiple Bull workers |
| `isInternal` string coercion bypass | DTO uses `@Transform` to coerce `"true"` string to boolean before validation |

---

## Out of Scope

- Comment editing (delete and repost)
- Rich text / markdown
- @mentions
- File attachments on comments (use existing complaint attachments)
- Read receipts on comments
