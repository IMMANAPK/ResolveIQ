# ResolveIQ

AI-powered complaint management system with intelligent routing, SLA tracking, sentiment analysis, and automated escalation.

---

## What It Does

| Feature | Description |
|---------|-------------|
| **AI Complaint Routing** | Groq (llama-3.3-70b) reads each complaint and assigns it to the best-fit committee with a confidence score |
| **AI Summarization** | Auto-generates a 2–3 sentence summary for every complaint on creation |
| **Sentiment Analysis** | Classifies complainant tone: `angry / frustrated / concerned / neutral / satisfied` |
| **SLA Tracking** | Deadlines by priority (Critical 4h, High 12h, Medium 24h, Low 72h); cron marks breaches every 10 min |
| **AI Escalation** | Groq decides per-complaint whether to send a reminder, re-route, trigger multi-channel alert, or skip |
| **Resolution Feedback** | Complainants rate resolutions (1–5 stars); AI summarizes comments |
| **Visual Workflow Builder** | Drag-and-drop automation engine (notify, delay, AI prompt, conditions) |
| **Analytics Dashboard** | Recharts charts: complaints over time, status donut, sentiment distribution, committee workload |
| **Real-time Updates** | WebSocket events push AI summary and routing status to the frontend |

---

## Tech Stack

**Backend** — NestJS · TypeORM · PostgreSQL · Redis (Bull queues) · Groq SDK · Nodemailer
**Frontend** — React · TanStack Query v5 · Recharts · Shadcn/ui · Framer Motion · Socket.io

---

## Project Structure

```
ResolveIQ/
├── ResolveIQ-Backend/       # NestJS API (port 3001)
│   └── src/modules/
│       ├── ai/              # Groq: summarize, route, sentiment, escalation decisions
│       ├── complaints/      # Core entity + service + SLA cron
│       ├── escalation/      # Scheduler + escalation logic
│       ├── feedback/        # Resolution ratings + AI summaries
│       ├── notifications/   # Notification records + rules
│       ├── workflows/       # Visual workflow engine
│       └── ...
└── frontend/                # React SPA (port 5173)
    └── src/
        ├── pages/           # Dashboard, ComplaintList, ComplaintDetail, ...
        ├── hooks/           # useComplaints, useFeedback, useComplaintStats, ...
        └── components/cms/  # StatusBadge, SentimentBadge, SlaBadge, StarRating, ...
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis

### Backend

```bash
cd ResolveIQ-Backend
cp .env.example .env       # fill in DB, Redis, GROQ_API_KEY, SMTP
npm install
npm run start:dev          # http://localhost:3001/api/v1
```

Key `.env` variables:

```env
DATABASE_URL=postgres://user:pass@localhost:5432/resolveiq
REDIS_HOST=localhost
REDIS_PORT=6379
GROQ_API_KEY=gsk_...
JWT_SECRET=your-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

### Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

### Seed Data

```bash
cd ResolveIQ-Backend
npm run seed               # creates admin user, committees, notification rules
```

Default admin: `admin@resolveiq.com` / `Admin@123`

---

## Core Flow

```
User files complaint
  → AI Summary (Groq)
  → AI Routing (assigns committee)
  → Email notification sent to committee members

Complaint ages past threshold
  → AI decides: reminder / re-route / multi-channel / skip
  → Escalation email sent with AI-generated tone (polite → urgent → critical)

Complaint resolved
  → Complainant submits star rating + comment
  → AI generates one-sentence feedback summary
```

---

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/login` | JWT login |
| GET/POST | `/complaints` | List / create complaints |
| GET | `/complaints/stats?days=30` | Analytics stats (privileged) |
| PATCH | `/complaints/:id/status` | Update status |
| GET/POST | `/complaints/:id/feedback` | Feedback CRUD |
| GET | `/workflows` | List workflow definitions |
| GET | `/notifications` | Notification history |
| GET/PATCH | `/settings` | AI & SMTP config (admin) |

---

## Roles

| Role | Access |
|------|--------|
| `admin` | Full access — settings, users, workflows, all complaints |
| `manager` | All complaints, escalations |
| `committee_member` | Assigned complaints, notifications |
| `complainant` | Own complaints only, submit feedback |
