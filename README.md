# ResolveIQ

A full-stack corporate complaint management system with AI-powered routing, smart escalation, and real-time tracking.

## Overview

ResolveIQ lets employees submit complaints that are automatically routed to the right committee using Groq AI, then tracked through a multi-stage escalation pipeline — from polite email reminders to rerouting to multi-channel alerts — until someone acts on them.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query |
| Backend | NestJS 11, TypeScript, TypeORM |
| Database | PostgreSQL |
| Queue | Bull + Redis |
| AI | Groq (Llama 3.3-70B) |
| Email | SendGrid / Nodemailer (SMTP fallback) |
| Real-time | Socket.IO |
| Auth | JWT + Passport.js |

## Project Structure

```
ResolveIQ/
├── ResolveIQ-Backend/   # NestJS REST API + WebSocket server
├── frontend/            # React + Vite SPA
└── docs/                # Design specs
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- A [Groq API key](https://console.groq.com) (free tier works)
- SendGrid API key **or** an SMTP account (e.g. Gmail app password)

## Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd ResolveIQ

# Backend
cd ResolveIQ-Backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment

```bash
cd ResolveIQ-Backend
cp .env.example .env
```

Edit `.env` with your values — see [Environment Variables](#environment-variables) below.

### 3. Seed the database

```bash
cd ResolveIQ-Backend
npm run seed
```

This creates sample users, committees, and categories. Default credentials:

| Role | Email | Password |
|---|---|---|
| Admin | admin@resolveiq.com | `Admin@123` |
| Manager | manager@resolveiq.com | `Welcome@123` |
| Committee Member | member@resolveiq.com | `Welcome@123` |
| Complainant | user@resolveiq.com | `Welcome@123` |

> Passwords are controlled by `SEED_ADMIN_PASSWORD` and `SEED_DEFAULT_PASSWORD` in `.env`.

### 4. Run

```bash
# Terminal 1 — Backend (http://localhost:3000)
cd ResolveIQ-Backend
npm run start:dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

## Environment Variables

All variables live in `ResolveIQ-Backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=resolveiq

# Redis (required for Bull job queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=7d

# Email — use SendGrid OR SMTP, not both
SENDGRID_API_KEY=           # leave blank to use SMTP
EMAIL_FROM=you@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password

# AI routing (required)
GROQ_API_KEY=your-groq-key

# App
APP_BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Escalation timing (minutes)
ESCALATION_REMINDER_MINUTES=60    # send AI reminder after 60 min
ESCALATION_REROUTE_MINUTES=180    # reroute to available members after 3h
ESCALATION_CRITICAL_MINUTES=360   # multi-channel push after 6h
ESCALATION_BATCH_SIZE=50          # max notifications processed per cron tick
```

## User Roles

| Role | Permissions |
|---|---|
| `admin` | Full access — manage users, committees, all complaints |
| `manager` | Oversee committees, view all complaints |
| `committee_member` | View and action assigned complaints |
| `complainant` | Submit and track own complaints |

## Complaint Lifecycle

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

Priority levels: `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`

Categories: `HR` · `IT` · `FACILITIES` · `CONDUCT` · `SAFETY` · `OTHER`

## Escalation Pipeline

The scheduler runs every 10 minutes and processes up to `ESCALATION_BATCH_SIZE` unacknowledged notifications per tick, oldest first.

| Stage | Trigger | Action |
|---|---|---|
| Reminder | After `ESCALATION_REMINDER_MINUTES` | AI-generated email with tone adapted to priority and reminder count |
| Reroute | After `ESCALATION_REROUTE_MINUTES` | Reassign to available committee members who haven't been notified |
| Multi-channel | After `ESCALATION_CRITICAL_MINUTES` | Push notification + in-app alert via WebSocket |

## API

Base URL: `http://localhost:3000/api/v1`

All endpoints except `POST /auth/login` require a `Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Authenticate, receive JWT |
| GET | `/users` | List all users (admin) |
| POST | `/users` | Create user (admin) |
| GET | `/complaints` | List complaints |
| POST | `/complaints` | Submit complaint |
| PATCH | `/complaints/:id/status` | Update status |
| GET | `/committees` | List committees |
| POST | `/committees` | Create committee (admin) |
| GET | `/notifications` | List notifications for current user |
| GET | `/escalation/:complaintId/history` | Escalation log for a complaint |
| POST | `/escalation/trigger` | Manually trigger escalation step |

## WebSocket Events

Connect to `ws://localhost:3000/events` with a valid JWT.

| Event | Direction | Payload |
|---|---|---|
| `complaint:updated` | Server → Client | `{ complaintId, status }` |
| `escalation:triggered` | Server → Client | `{ complaintId, step, message }` |
| `push:notification` | Server → Client | `{ userId, title, body, complaintId }` |

## Production Notes

- Set `NODE_ENV=production` — this disables TypeORM `synchronize` (auto schema changes). Run migrations manually instead.
- If migrating from an earlier version where `roles` was a `simple-array`, run this before deploying:
  ```sql
  ALTER TABLE users
    ALTER COLUMN roles TYPE jsonb
    USING to_jsonb(string_to_array(roles::text, ','));
  ```
- Add rate limiting to `/auth/login` before exposing publicly.
- `JWT_SECRET` must be a long random string in production.
