# ResolveIQ Frontend

React + TypeScript + Vite SPA for ResolveIQ. See the [root README](../README.md) for full setup instructions.

## Scripts

```bash
npm run dev      # development server (http://localhost:5173)
npm run build    # production build
npm run preview  # preview production build locally
npm run lint     # ESLint
```

## Pages

| Route | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/` | Dashboard | All roles |
| `/complaints` | Complaint list | All roles |
| `/complaints/:id` | Complaint detail + escalation | All roles |
| `/admin` | Admin panel | Admin |
| `/users` | User management | Admin |
| `/committee` | Committee dashboard | Committee member |
| `/committee-settings` | Committee configuration | Admin / Manager |
| `/notifications` | Notification inbox | All roles |

## Key Directories

```
src/
├── pages/        # Route-level page components
├── components/
│   ├── cms/      # App-specific components (layout, dialogs, panels)
│   └── ui/       # Radix UI base components
├── hooks/        # React Query hooks for API calls
├── contexts/     # AuthContext, RoleContext
├── types/        # TypeScript interfaces for API models
└── lib/
    └── api.ts    # Axios instance with JWT interceptor
```
