# ResolveIQ Backend

NestJS REST API for the ResolveIQ complaint management system.

See the [root README](../README.md) for full project documentation.

## Start

```bash
npm install
npm run start:dev   # http://localhost:3001/api/v1
```

## Commands

```bash
npm run start:dev   # watch mode
npm run build       # compile
npm run seed        # seed DB with admin, committees, notification rules
npm run test        # unit tests
npm run test:e2e    # e2e tests
```

## Modules

| Module | Responsibility |
|--------|---------------|
| `ai` | Groq: summarize, route, sentiment analysis, escalation decisions, feedback summaries |
| `complaints` | Core complaint CRUD, SLA deadline computation, analytics stats |
| `escalation` | Cron scheduler, AI-driven escalation actions, reminder emails |
| `feedback` | Resolution ratings (1–5 stars), AI one-sentence summaries |
| `notifications` | Notification records, notification rules per committee |
| `workflows` | Visual workflow engine with nodes: notify, delay, AI prompt, condition, send-email |
| `auth` | JWT authentication |
| `users` | User management |
| `committees` | Committee management with category mappings |
| `email` | Nodemailer SMTP wrapper |
| `gateway` | WebSocket events (summary updates, routing status) |
| `settings` | DB-backed config for AI key and SMTP (admin-editable) |
