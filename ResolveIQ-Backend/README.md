# ResolveIQ Backend

NestJS REST API + WebSocket server for ResolveIQ. See the [root README](../README.md) for full setup instructions.

## Scripts

```bash
npm run start:dev   # development with watch
npm run start:prod  # production build
npm run seed        # seed database with sample data
npm run test        # unit tests
npm run test:e2e    # e2e tests
npm run test:cov    # coverage report
```

## Module Overview

| Module | Responsibility |
|---|---|
| `auth` | JWT authentication via Passport |
| `users` | User CRUD, role management, availability |
| `complaints` | Complaint lifecycle and status updates |
| `committees` | Committee definitions and category mappings |
| `notifications` | Multi-channel notification delivery and tracking |
| `escalation` | Cron-driven escalation pipeline (reminder → reroute → multi-channel) |
| `ai` | Groq integration for complaint routing and reminder generation |
| `email` | SendGrid/SMTP delivery, HTML templates, tracking pixels |
| `gateway` | Socket.IO WebSocket server for real-time events |
