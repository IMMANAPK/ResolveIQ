# AI Workflow Builder — Design Spec

**Date:** 2026-03-18
**Project:** ResolveIQ
**Scope:** Three-phase AI automation system — complaint summary, smart routing, and a full drag-and-drop workflow builder.

---

## Overview

ResolveIQ currently routes complaints to committees manually or via hardcoded AI logic. This spec introduces a three-phase AI automation system:

- **Phase 1:** Auto-generate an AI summary for every complaint asynchronously. No notification is sent in Phase 1.
- **Phase 2:** Async AI routing using the summary as context, then send the committee notification (with summary included). Also adds configurable notification rules.
- **Phase 3:** A node-based drag-and-drop workflow builder where admins define custom automations.

**Notification sequencing:** Notifications are sent exclusively by Phase 2 (after routing resolves the committee). Phase 1 only generates the summary and pushes the Phase 2 job. This avoids sending notifications before the committee is known.

**Runtime dependency:** Phase 2 is triggered by Phase 1's queue processor. Phase 3 introduces a separate workflow engine that coexists with the Phase 1/2 queue processors — it does not replace them in Phase 3 initial delivery.

**Existing code affected:**
- The synchronous notification call in `ComplaintsService.create()` (via `ComplaintNotifierService`) is removed. Notifications move to Phase 2.
- The routing logic in `ComplaintNotifierService.notifyCommittee()` is removed. The method will instead read `committeeId` from the already-resolved complaint record.
- `ComplaintNotifierService.notifyManagers()` (used for escalation) is updated to read `complaint.committeeId` instead of resolving the committee inline.

**Queue library:** The project uses `bull` v4 via `@nestjs/bull`. All queue references in this spec use `bull`/`@nestjs/bull` semantics. The separate `bullmq` package is not used.

---

## Role Reference

Throughout this spec, roles use the exact `UserRole` enum values from the codebase:

| Colloquial | Exact value |
|---|---|
| Admin | `admin` |
| Manager | `manager` |
| Committee member | `committee_member` |
| Complainant | `complainant` |

---

## Phase 1 — Async AI Summary

### Goal
Generate a concise AI summary for every new complaint in the background. The summary is shown on the complaint detail page and included in the committee notification email sent by Phase 2.

### DB Changes — Complaint entity

All new columns are nullable to avoid breaking existing records.

| Field | Type | Description |
|---|---|---|
| `aiSummary` | `text \| null` | Generated summary text |
| `aiSummaryStatus` | `enum \| null` | `pending \| completed \| failed` |
| `aiSummaryRequestedAt` | `timestamp \| null` | When the job was pushed |
| `aiSummaryCompletedAt` | `timestamp \| null` | When AI responded successfully |
| `aiSummaryError` | `text \| null` | Failure reason for debugging |

### Backend

**New bull queue:** `ai-summary` (registered via `@nestjs/bull`)

**Existing code change:** Remove the synchronous notification call from `ComplaintsService.create()`. No notification is sent at submission time.

**Flow:**
1. `ComplaintsService.create()` saves the complaint with `aiSummaryStatus: 'pending'` and `aiSummaryRequestedAt: now()`, adds a job to the `ai-summary` queue with a `timeout: 30000` (30 s) option, and returns immediately.
2. `AiSummaryProcessor` picks up the job:
   - Calls `AiService.generateSummary(complaint)` — a new method with a dedicated prompt, separate from `routeComplaint()` and `generateReminderEmail()`.
   - On **success**: updates `aiSummary`, `aiSummaryStatus: 'completed'`, `aiSummaryCompletedAt`.
   - On **failure** (after bull retries exhausted, or job timeout): updates `aiSummaryStatus: 'failed'`, `aiSummaryError`.
3. After either outcome (success or failure), the processor adds a job to the `complaint-routing` queue (Phase 2). Routing is never blocked by summary failure.
4. Emits WebSocket event `complaint.summary.updated` scoped to room `complaint:{complaintId}` via the existing `EventsGateway`. Frontend joins this room on complaint detail page mount.

### Frontend — ComplaintDetail page

| `aiSummaryStatus` | UI |
|---|---|
| `null` or `pending` | Skeleton card labelled "Generating AI summary…" |
| `completed` | Summary card with content |
| `failed` | Subtle "Summary unavailable" badge + "Regenerate" button |

The **Regenerate** button calls `POST /complaints/:id/regenerate-summary` (roles: `admin`, `committee_member`). This re-queues the job and resets `aiSummaryStatus` to `pending`, clears `aiSummaryError`.

---

## Phase 2 — Async Routing + Smart Notifications

### Goal
Resolve which committee a complaint belongs to, then send the committee notification email (with summary if available). Additionally, let admins configure per-committee notification recipients and conditional rules.

### Trigger
`AiSummaryProcessor` (Phase 1) adds a job to the `complaint-routing` queue after completing summary generation, regardless of outcome.

### Existing code changes
- Remove routing logic from `ComplaintNotifierService.notifyCommittee()`. After Phase 2, `notifyCommittee()` receives a pre-resolved `committeeId` from the complaint record.
- Update `ComplaintNotifierService.notifyManagers()` to read `complaint.committeeId` (set by Phase 2) rather than resolving the committee inline.

### DB Changes — Complaint entity

| Field | Type | Description |
|---|---|---|
| `committeeId` | `uuid \| null` FK → Committee | Resolved committee |
| `routingMethod` | `enum \| null` | `ai \| category \| manual` |
| `routingConfidence` | `float \| null` | AI confidence score 0–1 (new float field; unrelated to any existing string enum fields on this entity) |
| `routingReason` | `text \| null` | Human-readable routing explanation |
| `routingRawAiResponse` | `json \| null` | Full raw AI response for analysis |
| `notificationSentAt` | `timestamp \| null` | Set after committee notification email is sent; idempotency guard against duplicate sends on retry |

### Routing fallback chain

`AiService.routeComplaintWithConfidence(complaint)` is a new method returning `{ committee: string, confidence: number, reason: string }`. The existing `AiService.routeComplaint()` method (which returns a string enum confidence) is removed as part of Phase 2 — it is no longer called once `ComplaintNotifierService.notifyCommittee()` has its routing logic removed.

If `routingConfidence < ROUTING_CONFIDENCE_THRESHOLD` (env var, default `0.7`):
1. Call `CommitteesService.findByCategory(complaint.category)` — existing DB category mapping.
2. If no mapping found, call `CommitteesService.findByCategory('other')` — the catch-all committee.
3. If still no result, set `committeeId: null`, `routingMethod: 'category'`, log a warning. No notification is sent; the complaint remains unassigned until manually routed.

### New Entity — NotificationRule

```
id
committeeId       FK → Committee
type              enum: default | conditional
condition         json | null
                  Schema: { field: 'priority' | 'category', op: 'eq' | 'neq', value: string }
                  Valid 'priority' values: 'low' | 'medium' | 'high' | 'critical'
                  Valid 'category' values: 'hr' | 'it' | 'facilities' | 'conduct' | 'safety' | 'other'
recipientUserIds  simple-array of user UUIDs
recipientRoles    simple-array — valid values: 'admin' | 'manager' | 'committee_member'
order             int (lower = evaluated first)
```

### Backend

**New bull queue:** `complaint-routing`

**Flow:**
1. `ComplaintRoutingProcessor` receives the job.
2. Calls `AiService.routeComplaintWithConfidence()` with `title + description + aiSummary` (if available).
3. Applies confidence check + fallback chain to resolve `committeeId`.
4. Saves routing fields to complaint: `committeeId`, `routingMethod`, `routingConfidence`, `routingReason`, `routingRawAiResponse`.
5. Loads `NotificationRule` records for the resolved committee, ordered by `order` ASC.
6. Evaluates rules: `default` rules always apply; `conditional` rules apply when the condition matches complaint fields.
7. Merges `recipientUserIds` and expands `recipientRoles` (querying users with those roles). Deduplicates.
8. Before sending: check `notificationSentAt` — if already set, skip (idempotency guard for bull retries).
9. Sends in-app notifications and emails to resolved recipients. Email includes `aiSummary` if `aiSummaryStatus === 'completed'`, otherwise omits the summary section.
10. Sets `notificationSentAt: now()`.

### Frontend — Committee Settings (existing page, new section)

- **Default recipients** — multi-select of users; always notified when a complaint is routed to this committee.
- **Conditional rules** — condition builder: field → operator → value (enum dropdowns) → recipients.
- Rules listed in evaluation order, drag-to-reorder.
- **Test rule** button — dry-evaluates rules against a sample `{ priority, category }` and shows resolved recipients without sending.

---

## Phase 3 — Workflow Builder

### Goal
Allow admins to build custom automation workflows using a drag-and-drop visual canvas. Workflows are stored as versioned JSON definitions and executed step-by-step via bull queues. Phase 3 coexists with Phase 1/2 processors.

### Known limitations (explicit scope decisions)

- **No transactional rollback.** If a workflow partially completes then fails, complaint fields updated by prior `update_complaint` nodes are not reversed. This is a known limitation — workflow execution is not atomic.
- **No fan-out concurrency limit.** If many workflows match a single event, all are queued immediately. Max concurrent runs are bounded by the bull worker concurrency setting (default: 1 per process). Rate limiting is out of scope for Phase 3 initial delivery.

### JSON Schema

```json
{
  "schemaVersion": 1,
  "nodes": [
    { "id": "n1", "type": "trigger",           "config": { "event": "complaint.created" } },
    { "id": "n2", "type": "ai_prompt",         "config": { "promptSlug": "routing", "outputVar": "committee" } },
    { "id": "n3", "type": "condition",         "config": { "field": "complaint.priority", "op": "eq", "value": "high" } },
    { "id": "n4", "type": "send_notification", "config": { "recipientRoles": ["manager"] } },
    { "id": "n5", "type": "update_complaint",  "config": { "field": "status", "value": "in_review" } },
    { "id": "n6", "type": "delay",             "config": { "minutes": 60 } }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" },
    { "from": "n3", "to": "n4", "condition": "true" },
    { "from": "n3", "to": "n5", "condition": "false" },
    { "from": "n5", "to": "n6" }
  ]
}
```

**Field namespace convention:**
- Plain variable name (e.g. `"committee"`) — a context variable written by a prior `ai_prompt` node via `outputVar`. Stored in `WorkflowRun.context` as `context.committee`.
- `complaint.fieldName` prefix — a complaint field read directly from the DB (e.g., `complaint.priority`, `complaint.category`).
- `condition` nodes' `config.field` must use one of these two forms. The engine resolves `ctx.*` from `WorkflowRun.context` and `complaint.*` from the complaint record.

### Node Types

| Type | Config fields | Description |
|---|---|---|
| `trigger` | `event` | Entry point. Exactly one per workflow. |
| `ai_prompt` | `promptSlug`, `outputVar` (plain name, no prefix) | Calls AI; stores result in `context[outputVar]`. Executed live even in dry-run (real Groq call). |
| `condition` | `field` (namespaced), `op`, `value` | Branches true/false. Must have exactly 2 outgoing edges. |
| `send_notification` | `recipientUserIds?`, `recipientRoles?`, `message?` | In-app notification. Skipped in dry-run. |
| `send_email` | `recipientUserIds?`, `recipientRoles?`, `subject`, `body` | Email. Skipped in dry-run. |
| `update_complaint` | `field` (`status \| priority \| committeeId`), `value` | Updates a complaint field. Skipped in dry-run. |
| `delay` | `minutes` | Pauses via bull delayed job. Cumulative sum of all delay nodes must not exceed `maxRunDurationSeconds`. |

### DB Entities

**WorkflowDefinition**
```
id
name, description
trigger            json  — { type: 'event' | 'manual', event?: string }
                   Authoritative trigger config for event matching. Synced from the trigger
                   node's config on every save. WorkflowEngineService queries this column.
definition         json  — full node+edge graph with schemaVersion nested inside
schemaVersion      int   — JSON format version; incremented only when the schema structure changes
definitionVersion  int   — edit revision counter; incremented by 1 on every save
isActive           boolean
maxRunDurationSeconds  int  — default 300. Sum of all delay node minutes * 60 must not exceed this.
createdBy          FK → User
createdAt, updatedAt
```

**WorkflowRun**
```
id
workflowId            FK → WorkflowDefinition
definitionVersion     int  — snapshot of WorkflowDefinition.definitionVersion at run start
complaintId           FK → Complaint
status                enum: running | completed | failed | cancelled | timed_out
triggeredBy           enum: event | manual
context               json  — flat object of accumulated variables, e.g. { "committee": "IT Committee" }
startedAt, completedAt
error                 text | null
```

**WorkflowStepLog**
```
id
runId          FK → WorkflowRun
nodeId         string — matches node id in definition JSON
nodeType       string
status         enum: pending | running | completed | failed | skipped
input          json   — deep copy of context before this step
output         json   — values written to context by this step; null if skipped
skippedReason  text | null — 'dry-run' | 'condition branch not taken'
retryPolicy    json | null — { maxAttempts: int, backoffMs: int }; null = queue defaults
startedAt, completedAt
error          text | null
```

### Execution Engine

**`WorkflowEngineService`**
- `triggerByEvent(event, complaintId)` — queries `WorkflowDefinition` where `trigger->>'event' = :event AND isActive = true`. For each match, creates a `WorkflowRun` (snapshots `definitionVersion`), adds first node job to `workflow-steps` queue.
- `triggerManual(workflowId, complaintId)` — same, `triggeredBy: 'manual'`.
- Rejects definitions whose `schemaVersion` exceeds the current supported max constant.

**`WorkflowStepProcessor`** (bull worker on `workflow-steps` queue)
1. Loads `WorkflowRun` (with `context`) and its `WorkflowDefinition.definition`.
2. Finds or creates `WorkflowStepLog` for current `nodeId`.
3. Executes node handler (AI call, notification, DB update, etc.).
4. Merges output into `WorkflowRun.context`.
5. Resolves outgoing edges. For `condition` nodes: evaluates condition, marks the un-taken branch's target node `skipped` with `skippedReason: 'condition branch not taken'`.
6. Adds next node job(s) to queue, or marks run `completed` if no outgoing edges remain.
7. On failure: marks step `failed`, checks `retryPolicy`. Rethrows if retries remain. Marks run `failed` when retries exhausted.

**Timeout enforcement:** A NestJS `@Cron` job runs every minute. Queries `WorkflowRun` where `status = 'running' AND startedAt < NOW() - INTERVAL '<maxRunDurationSeconds> seconds'`. Marks overdue runs `timed_out`. Time spent in `delay` nodes counts toward this limit.

**Context propagation:** `WorkflowRun.context` is a flat JSON object. `ai_prompt` writes `context[outputVar]`. `condition` nodes resolve `complaint.X` from DB and plain names from `context`. `WorkflowStepLog.input` is a deep copy of context before execution; `output` is the diff written by that step.

**Dry-run:** `POST /admin/workflows/:id/dry-run` with `{ complaintId }`. Side-effect nodes (`send_notification`, `send_email`, `update_complaint`) are skipped (logged with `skippedReason: 'dry-run'`, `output: null`). `ai_prompt` nodes execute live against Groq. `condition` nodes that read context values from skipped `ai_prompt` outputs use `undefined`; condition nodes reading `complaint.*` fields read from DB. Returns the full `WorkflowStepLog` array as the trace.

**Schema validation (save-time):**
- Exactly one `trigger` node.
- All edge `from`/`to` reference valid node IDs.
- `condition` nodes have exactly two outgoing edges (`condition: "true"` and `condition: "false"`).
- No cycles in the graph.
- Sum of all `delay` node `minutes * 60 ≤ maxRunDurationSeconds`.
- `trigger` column synced from trigger node config before saving.
- `definitionVersion` incremented by 1.

### Frontend

**`/admin/workflows`** — Workflow list
- Table: name, trigger event, `definitionVersion`, last run status, last run time, active toggle.
- "New Workflow" button.
- Route added to AppSidebar admin nav; wrapped in `AdminRoute` guard.

**`/admin/workflows/:id`** — Workflow canvas (`@xyflow/react`)
- Left sidebar: node palette (drag to canvas).
- Canvas: directed edges; condition nodes show `true`/`false` labels.
- Right panel: config form on node select, with namespace hints for field inputs.
- Top bar: workflow name, Save, Activate/Deactivate, "Dry Run" button.
- "Run History" tab: `WorkflowRun` list with `definitionVersion`, expandable step timelines.

**Complaint detail page** — new "Workflow Runs" section
- Lists `WorkflowRun` records for this complaint.
- Expandable per-run step timeline: node type, status, duration, input/output preview.

---

## Cross-Cutting Concerns

### Queue library

`@nestjs/bull` (wrapping `bull` v4) is used for all queues. Job timeout uses bull's `timeout` job option (milliseconds). Do not install `bullmq` or `@nestjs/bullmq`.

### Trigger types (Phase 3)

| Type | Phase | Implementation |
|---|---|---|
| Event-based | Phase 3 initial | `EventEmitter2`; events: `complaint.created`, `complaint.status_changed`, `complaint.escalated` |
| Manual | Phase 3 initial | `POST /admin/workflows/:id/run` with `{ complaintId }` |
| Scheduled | Phase 3 future | Bull repeatable jobs |

### Libraries

| Library | Purpose | Status |
|---|---|---|
| `@nestjs/bull` | Queue integration (all phases) | Already installed |
| `bull` | Underlying queue driver | Already installed |
| `@xyflow/react` | Workflow canvas (Phase 3) | New dependency |

### API surface (new endpoints)

```
# Phase 1
POST   /complaints/:id/regenerate-summary               roles: admin, committee_member

# Phase 2
GET    /committees/:id/notification-rules               roles: admin
POST   /committees/:id/notification-rules               roles: admin
PATCH  /committees/:id/notification-rules/:ruleId       roles: admin
DELETE /committees/:id/notification-rules/:ruleId       roles: admin

# Phase 3
GET    /admin/workflows                                 roles: admin
POST   /admin/workflows                                 roles: admin
GET    /admin/workflows/:id                             roles: admin
PATCH  /admin/workflows/:id                             roles: admin
DELETE /admin/workflows/:id                             roles: admin
POST   /admin/workflows/:id/dry-run                     roles: admin
POST   /admin/workflows/:id/run                         roles: admin
GET    /admin/workflows/:id/runs                        roles: admin
GET    /admin/workflow-runs/:runId                      roles: admin
```

Note: `GET /admin/workflow-runs/:runId` uses a separate base path to avoid NestJS route conflict with `GET /admin/workflows/:id`.

### Frontend access control

All `/admin/workflows` routes are wrapped in the existing `AdminRoute` component (same pattern as other admin pages). API endpoints return 403 for non-admin roles as a second layer.

### Out of scope (future)

- External integrations (webhooks, Slack)
- Scheduled triggers
- Workflow templates library
- Delay-based polling loops (cycles with delay nodes)
- Fan-out concurrency limits and per-workflow rate limiting
- Transactional rollback of partial workflow execution
- Replacing Phase 1/2 queue processors with workflow definitions
- Workflow import/export

---

## Implementation Order

1. **Phase 1** — AI Summary (standalone; removes existing sync notification path)
2. **Phase 2** — Routing + Notification Rules (removes existing inline routing; adds notification after routing)
3. **Phase 3** — Workflow Builder (new coexisting system; Phase 1/2 queues remain)
