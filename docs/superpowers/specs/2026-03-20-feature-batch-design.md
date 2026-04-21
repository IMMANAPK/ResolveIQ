# ResolveIQ Feature Batch: Analytics, Sentiment, SLA, Feedback

**Date:** 2026-03-20
**Status:** Approved
**Scope:** 4 focused features to improve demo quality and production readiness

---

## Feature 1: Analytics Dashboard

### Goal
Replace the basic stat cards on Dashboard.tsx with a rich analytics view using Recharts (already installed, currently unused).

### Backend

**New endpoint:** `GET /complaints/stats`
Add a `getStats()` method to `ComplaintsService` that returns aggregated data in a single response. Uses raw TypeORM queries for efficiency — no N+1.

**Response shape:**
```typescript
interface ComplaintStats {
  total: number;
  byStatus: Record<ComplaintStatus, number>;
  byPriority: Record<ComplaintPriority, number>;
  byCategory: Record<ComplaintCategory, number>;
  bySentiment: Record<ApiSentimentLabel | 'unknown', number>; // from Feature 2; null labels grouped as 'unknown'
  overTime: Array<{ date: string; created: number; resolved: number }>;  // last 30 days
  avgResolutionHours: number | null;
  slaBreachCount: number;                             // from Feature 3
  slaBreachRate: number;                              // breached / total
  avgFeedbackRating: number | null;                   // from Feature 4
  committeeWorkload: Array<{ committeeName: string; count: number; avgRating: number | null }>;
}
```

**Query approach:**
- `byStatus` / `byPriority` / `byCategory`: `GROUP BY` on complaints table
- `overTime`: `DATE_TRUNC('day', "createdAt")` grouped, last 30 days; separate query for resolved counts by `resolvedAt`
- `avgResolutionHours`: `AVG(EXTRACT(EPOCH FROM (resolvedAt - createdAt)) / 3600)` where resolvedAt IS NOT NULL
- `committeeWorkload`: `SELECT c.name, COUNT(comp.id), AVG(f.rating) FROM committees c LEFT JOIN complaints comp ON comp."committeeId" = c.id LEFT JOIN feedback f ON f."complaintId" = comp.id GROUP BY c.id, c.name`
- `bySentiment`: `GROUP BY "sentimentLabel"` — rows with `NULL` label grouped under `'unknown'` key
- SLA stats: `COUNT(*) WHERE slaBreached = true` for count; divide by total for rate

**Route:** Added to `ComplaintsController` as `@Get('stats')` immediately after `@Get('my')` and before `@Get(':id')` to avoid param conflicts. Restricted to admin/manager roles.

**Date range filtering:** The `days` query param (default 30) filters ALL stats to complaints created within the last N days. Frontend passes `?days=7`, `?days=30`, or `?days=90`.

### Frontend

**New hook:** `useComplaintStats()` — fetches `GET /complaints/stats`

**Dashboard.tsx rewrite:**
- **Top row:** 4 stat cards — Total Complaints, Avg Resolution Time, SLA Breach Rate, Avg Satisfaction
- **Second row (2 columns):**
  - Left: Area chart — complaints created vs resolved over last 30 days (dual lines)
  - Right: Donut chart — complaints by status (colored segments)
- **Third row (2 columns):**
  - Left: Horizontal bar chart — committee workload comparison
  - Right: Sentiment distribution (small donut from Feature 2 data)
- Date range filter (7d / 30d / 90d) passed as query param to backend

### Files touched
- `complaints.service.ts` — add `getStats(days?: number)`
- `complaints.controller.ts` — add `@Get('stats')` route
- `frontend/src/hooks/useComplaints.ts` — add `useComplaintStats()`
- `frontend/src/pages/Dashboard.tsx` — rewrite with Recharts
- `frontend/src/types/api.ts` — add `ApiComplaintStats` interface

---

## Feature 2: AI Sentiment Analysis

### Goal
Analyze emotional tone of complaints at creation time. Store on the complaint entity. Display as colored badges.

### Backend

**Type definitions (backend):**
```typescript
export type SentimentLabel = 'frustrated' | 'angry' | 'neutral' | 'concerned' | 'satisfied';
```

**Frontend type (in `api.ts`):**
```typescript
export type ApiSentimentLabel = 'frustrated' | 'angry' | 'neutral' | 'concerned' | 'satisfied';
```

**Complaint entity changes:** Add two nullable columns:
```typescript
@Column({ type: 'varchar', nullable: true })
sentimentLabel?: SentimentLabel;

@Column({ type: 'float', nullable: true })
sentimentScore?: number; // 0.0 (very negative) to 1.0 (very positive)
```

**AiService — new method:**
```typescript
async analyzeSentiment(complaint: { title: string; description: string }): Promise<{
  label: SentimentLabel;
  score: number;
  confidence: number;
}>
```

**Prompt:** Asks Groq to classify into one of the 5 labels, return a score 0-1, and a confidence 0-1. Structured JSON output. Temperature 0.1 for consistency.

**Fallback:** If Groq fails → `{ label: 'neutral', score: 0.5, confidence: 0 }`. Never blocks the summary pipeline.

**Integration point:** Called from `ai-summary.processor.ts` immediately after `generateSummary()` succeeds. Both results saved in the same `complaintRepo.update()` call. No extra queue.

### Frontend

**Sentiment badge component:** `SentimentBadge.tsx`
- Maps label → color: angry/frustrated → red, concerned → amber, neutral → gray, satisfied → green
- Shows label text + emoji indicator
- Displayed on:
  - `ComplaintDetail.tsx` — next to priority badge in header
  - `ComplaintList.tsx` — as a column/badge on each row
  - `Dashboard.tsx` — sentiment distribution chart (from stats endpoint)

**ApiComplaint type update:** Add `sentimentLabel?: ApiSentimentLabel` and `sentimentScore?: number` fields.

### Files touched
- `complaint.entity.ts` — add 2 columns
- `ai.service.ts` — add `analyzeSentiment()`
- `ai-summary.processor.ts` — call `analyzeSentiment()` after summary
- `frontend/src/types/api.ts` — update `ApiComplaint`
- `frontend/src/components/cms/SentimentBadge.tsx` — new component
- `frontend/src/pages/ComplaintDetail.tsx` — add badge
- `frontend/src/pages/ComplaintList.tsx` — add badge column

---

## Feature 3: SLA Tracking

### Goal
Auto-assign SLA deadlines based on priority. Track breaches. Show countdowns on the UI.

### Backend

**Complaint entity changes:** Add three columns:
```typescript
@Column({ type: 'timestamptz', nullable: true })
slaDeadline?: Date;

@Column({ default: false })
slaBreached: boolean;

@Column({ type: 'timestamptz', nullable: true })
slaBreachedAt?: Date;
```

**SLA deadline computation:** In `ComplaintsService.createAndNotify()`, after saving:
```typescript
const SLA_HOURS: Record<ComplaintPriority, number> = {
  critical: 4, high: 12, medium: 24, low: 72,
};
const deadline = new Date(complaint.createdAt.getTime() + SLA_HOURS[complaint.priority] * 3600000);
await this.repo.update(complaint.id, { slaDeadline: deadline });
```

**SLA breach cron:** New `SlaService` injecting `Repository<Complaint>`. Uses `createQueryBuilder()` for the bulk update with `@Cron(EVERY_10_MINUTES)`:
```typescript
await this.repo.createQueryBuilder()
  .update()
  .set({ slaBreached: true, slaBreachedAt: () => 'NOW()' })
  .where('"slaDeadline" < NOW()')
  .andWhere('"slaBreached" = false')
  .andWhere('status NOT IN (:...statuses)', { statuses: ['resolved', 'closed'] })
  .execute();
```
Single bulk query — efficient regardless of complaint count.

**SLA also cleared on resolution:** When status changes to `resolved`/`closed`, if `slaBreached` is still false, it stays false (met SLA). The deadline remains for historical reference.

### Frontend

**SLA badge component:** `SlaBadge.tsx`
- `slaBreached === true` → 🔴 "SLA Breached" + time since breach
- Not breached, within 20% of remaining time → 🟡 "At Risk" + countdown
- Healthy → 🟢 "On Track" + time remaining
- Resolved/closed → ✅ "Met SLA" or 🔴 "Breached" (historical)

**Displayed on:**
- `ComplaintDetail.tsx` — header area, next to priority and sentiment badges
- `ComplaintList.tsx` — SLA column with badge
- `Dashboard.tsx` — SLA breach rate stat card + included in stats

**ApiComplaint type update:** Add `slaDeadline?`, `slaBreached`, `slaBreachedAt?` fields.

### Files touched
- `complaint.entity.ts` — add 3 columns
- `complaints.service.ts` — compute deadline on create
- New `sla.service.ts` — breach cron
- `complaints.module.ts` — register SlaService
- `frontend/src/types/api.ts` — update `ApiComplaint`
- `frontend/src/components/cms/SlaBadge.tsx` — new component
- `frontend/src/pages/ComplaintDetail.tsx` — add badge
- `frontend/src/pages/ComplaintList.tsx` — add badge column

---

## Feature 4: Resolution Feedback + AI Summary

### Goal
Complainants rate resolved complaints (1-5 stars + comment). AI summarizes feedback. Feeds into dashboard metrics.

### Backend

**New entity:** `Feedback` in `modules/feedback/entities/feedback.entity.ts`:
```typescript
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';

@Entity('feedback')
@Unique(['complaintId'])  // one feedback per complaint
export class Feedback extends BaseEntity {
  @ManyToOne(() => Complaint)
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  rating: number; // 1-5

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'text', nullable: true })
  aiSummary?: string;
}
```

**New module:** `FeedbackModule` with:
- `FeedbackService` — CRUD + AI summary trigger
- `FeedbackController` — two endpoints

**Controller route:** `@Controller('complaints/:complaintId/feedback')` with `@Param('complaintId')`. This nests under the complaints path without conflicting with `ComplaintsController` since NestJS matches the full path.

**DTO validation:**
```typescript
export class CreateFeedbackDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
```

**Endpoints:**
- `POST /complaints/:complaintId/feedback` — body: `CreateFeedbackDto`
  - Validates: complaint exists, status is resolved/closed, user is the complainant, no existing feedback
  - Saves feedback, then fire-and-forget calls `AiService.summarizeFeedback()` if comment is non-empty
- `GET /complaints/:complaintId/feedback` — returns feedback or 404

**AiService — new method:**
```typescript
async summarizeFeedback(context: {
  complaintTitle: string;
  rating: number;
  comment: string;
}): Promise<string>
```
Returns a one-sentence AI summary. Example: *"Complainant is satisfied with resolution speed but notes communication could improve."*

Fallback: if Groq fails, leave `aiSummary = null`. Raw comment is always available.

### Frontend

**New hook:** `useFeedback(complaintId)` and `useSubmitFeedback()`

**ComplaintDetail.tsx additions:**
- When complaint is resolved/closed AND current user is the complainant:
  - No feedback yet → show feedback form: star rating selector (1-5) + optional textarea + submit button
  - Feedback exists → show read-only card with stars, comment, AI summary
- For non-complainant users → show feedback card read-only if it exists, hidden if not

**Star rating component:** `StarRating.tsx` — interactive (for form) or static (for display). Uses Lucide `Star` icon with fill states.

**Dashboard integration:**
- `avgFeedbackRating` shown as stat card: "Avg Satisfaction: ⭐ 4.2"
- Per-committee average rating shown in committee workload chart

### Frontend types
```typescript
export interface ApiFeedback {
  id: string;
  complaintId: string;
  userId: string;
  rating: number;
  comment?: string;
  aiSummary?: string;
  createdAt: string;
}
```

### Files touched
- New `modules/feedback/` — entity, service, controller, module
- `ai.service.ts` — add `summarizeFeedback()`
- `app.module.ts` — import FeedbackModule
- `frontend/src/types/api.ts` — add `ApiFeedback`
- `frontend/src/hooks/useFeedback.ts` — new hook
- `frontend/src/components/cms/StarRating.tsx` — new component
- `frontend/src/pages/ComplaintDetail.tsx` — add feedback section

---

## Cross-Cutting Concerns

### Database migrations
All new columns use `nullable: true` or have defaults, so TypeORM `synchronize: true` (dev mode) handles them automatically. For production, migrations should be generated after implementation.

### Error handling
All new Groq calls (sentiment, feedback summary) follow the established pattern: try/catch with fallback values, never block the primary operation.

### API types
All new backend fields must be mirrored in `frontend/src/types/api.ts` to maintain type safety.

### Feature interdependencies
- Analytics Dashboard depends on all 3 other features for complete stats (sentiment distribution, SLA breach rate, avg feedback rating)
- Implementation order: **Sentiment → SLA → Feedback → Dashboard** (so the dashboard has all data sources ready)

---

## Implementation Order

1. **AI Sentiment Analysis** — entity columns + AI method + processor integration + badge component
2. **SLA Tracking** — entity columns + deadline computation + breach cron + badge component
3. **Resolution Feedback** — new module + entity + endpoints + AI summary + frontend form
4. **Analytics Dashboard** — stats endpoint + Recharts dashboard rewrite (consumes all above)
