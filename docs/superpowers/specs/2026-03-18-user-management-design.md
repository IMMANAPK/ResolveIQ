# User Management — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Admin users can create individual users and bulk-import users from an Excel sheet. Backend `UserRole` enum (no schema changes): `admin`, `complainant`, `committee_member`, `manager`. Admin creates users with roles `complainant`, `committee_member`, or `manager`. Creating admin via UI is blocked at the UI layer only — the backend DTO accepts it; this is an accepted known gap, no backend change needed.

Committee members carry an optional committee name (e.g., "Women's Safety Committee") in the `department` field.

---

## Architecture: Two Independent Role Systems

| System | Hook | Type | Purpose |
|---|---|---|---|
| `AuthContext` | `useAuth().user.role` | `ApiUserRole` (`'admin'\|'complainant'\|'committee_member'\|'manager'`) | Real JWT role |
| `RoleContext` | `useRole().role` | `UserRole` from `ui.ts` (`"admin"\|"committee"\|"complainant"`) | UI-only role switcher |

- `AdminRoute` reads `AuthContext`. Sidebar reads `RoleContext`. These are independent.
- How `RoleContext` maps from `ApiUserRole` after login is existing behaviour — not changed by this spec.

---

## Backend

### Global prefix
`app.setGlobalPrefix('api/v1')` in `main.ts`. `@Controller('users')` → `/api/v1/users`.

### New: `GET /api/v1/users`

Add to `UsersService`:
```ts
async findAll(): Promise<User[]> {
  return this.repo.find(); // all non-soft-deleted users, regardless of isActive
}
```

`find()` returns TypeORM entity class instances — `@Exclude()` on `passwordHash` + global `ClassSerializerInterceptor` in `main.ts` will exclude `passwordHash` automatically. Do not convert to a plain object or DTO; return entity instances directly.

Add to `UsersController` — insert **after `@Post()`** and **before `@Get('committee')`** (do not reorder existing handlers):
```ts
@Get()
@Roles(UserRole.ADMIN)
findAll() {
  return this.usersService.findAll();
}
```

Note: `@Get()` (no path argument) matches only `GET /users` exactly. `@Get('committee')` matches `GET /users/committee`. These are distinct paths — no shadowing occurs regardless of order. Placement after `@Post()` is a readability convention only.

The class already has `@UseGuards(JwtAuthGuard, RolesGuard)` — do **not** repeat these at method level. Only `@Roles` is needed.

### `POST /api/v1/users` (no changes)
- Accepts: `{ email, password, fullName, role, department?, phone? }`
- `phone` always `undefined` in this feature
- `role` must be exact enum string: `complainant`, `committee_member`, or `manager`
- No backend change to prevent `admin` role — UI restriction is the only control (accepted gap)

### Passwords
- Add User dialog: admin enters explicitly (min 6 chars)
- Excel import: `Welcome@123` set client-side

---

## Frontend

### API URL
`axios` baseURL = `'/api/v1'`. All hooks use relative paths: `api.get('/users')` → `/api/v1/users`.

### Type Change: `src/types/api.ts`
`department` and `phone` already exist on the backend `User` entity and are returned by `GET /users`. Add to the frontend `ApiUser` interface (frontend type was missing these):
```ts
department?: string;
phone?: string;
```

### Route: `src/App.tsx`

The existing App.tsx uses a layout-route pattern — all protected pages are children of a parent layout route that renders `<CMSLayout />` via `<Outlet />`. Add `/users` as a **child route** within that layout, not as a standalone wrapped route.

Add `AdminRoute` guard component (reads `AuthContext`, not `RoleContext`). Must handle `isLoading` state to avoid premature redirect on hard refresh (consistent with how `ProtectedRoute` works):
```tsx
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth(); // ApiUser from AuthContext
  if (isLoading) return null;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

Add child route inside the existing layout route's children:
```tsx
<Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
```
`ProtectedRoute` is already applied by the parent layout route — do not add it again.

### Sidebar: `src/components/cms/AppSidebar.tsx`
- Add to the `admin` array in `navByRole` (using named import from lucide-react):
  ```ts
  import { ..., Users } from "lucide-react";
  // in navByRole.admin:
  { title: "Users", url: "/users", icon: Users }
  ```
- `navByRole` is keyed on `UserRole` from `ui.ts` (`"admin"|"committee"|"complainant"`). This addition is to the `"admin"` key only.

### Hook: `src/hooks/useUsers.ts`
```ts
// staleTime omitted — inherits global default (30s) already configured in App.tsx QueryClient
useUsers()      — api.get<ApiUser[]>('/users'), queryKey: ['users']
useCreateUser() — api.post<ApiUser>('/users', payload), invalidates ['users'] on success
```

`CreateUserPayload`:
```ts
{
  email: string;
  password: string;
  fullName: string;
  role: 'complainant' | 'committee_member' | 'manager'; // exact backend enum strings
  department?: string;
}
```

### Page: `src/pages/UserManagement.tsx`
- Header: "User Management" + subtitle "Manage system users and bulk import from Excel"
- Buttons: **Add User** → `AddUserDialog`, **Import from Excel** → `ImportUsersDialog`
- Table via `useUsers()`:

| Column | Source | Render |
|---|---|---|
| Name | `user.fullName` | text |
| Email | `user.email` | text |
| Role | `user.role` | inline Tailwind badge span — see Role Badges |
| Department / Committee | `user.department` | text; render `—` (em dash) if `undefined` or empty string |
| Status | `user.isActive` | `true` → green "Active" badge; `false` → grey "Inactive" badge |
| Created | `user.createdAt` | `new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` → e.g., "Mar 18, 2026" |

**Role Badges** (inline `<span>` with Tailwind — no new component):
| Value | Label | Tailwind classes |
|---|---|---|
| `complainant` | Complainant | `bg-blue-100 text-blue-700` |
| `committee_member` | Committee | `bg-purple-100 text-purple-700` |
| `manager` | Manager | `bg-orange-100 text-orange-700` |
| `admin` | Admin | `bg-gray-100 text-gray-700` |

- Loading: spinner or skeleton rows
- Empty state: "No users yet"
- No pagination

### Dialog: `src/components/cms/AddUserDialog.tsx`
Fields (react-hook-form + zod):

| Field | Input | Validation |
|---|---|---|
| Full Name | text | required, min 2 chars |
| Email | email | required, valid email |
| Role | select | required; values: `complainant`, `committee_member`, `manager`; labels: "Complainant", "Committee Member", "Manager" |
| Department / Committee | text | optional; **rendered only when role = `committee_member`** |
| Password | password | required, min 6 chars (admin enters explicitly) |

- On submit: `useCreateUser({ email, password, fullName, role, department? })`
- On 201: `toast.success("User created successfully")`, reset form, close dialog
- On 409: `toast.error("Email already registered")`
- On other error: `toast.error("Failed to create user")`

### Dialog: `src/components/cms/ImportUsersDialog.tsx`

**Dialog state:** Track `step: 1 | 2 | 3` and `parsedRows`.
- On dialog **open**: reset to `step = 1`, `parsedRows = []`
- On **Back** from Step 2: reset to `step = 1`, clear `parsedRows`
- Re-selecting a file in Step 1: replaces `parsedRows`
- During Step 3 (importing in progress): **disable dialog close** — set `onOpenChange` to a no-op while importing. The user cannot close the dialog via Escape or backdrop click until all rows are processed and "Done" is clicked.

---

**Step 1 — Upload**

- **"Download Template":** generates `.xlsx` client-side via SheetJS at click time.
  - Headers: `[fullName, email, role, department]`
  - Example row 1: `John Doe | john@example.com | complainant | `
  - Example row 2: `Jane Smith | jane@example.com | committee_member | Women's Safety Committee`
  - Download as `user-import-template.xlsx`
- **File input:** `.xlsx`, `.xls` only
- On file selected → parse with SheetJS (`sheet_to_json` with header row) → run file-level checks:
  - Missing required column (`fullname`, `email`, or `role` — case-insensitive) → show inline error, stay on Step 1
  - Zero data rows (valid header, no rows below) → "No data rows found. Please add users to the template."
  - More than 500 data rows → "File exceeds the 500-row limit."
  - Parse failure → "Could not read file. Please use the provided template."
  - On pass → advance to Step 2

---

**Step 2 — Preview & Validate**

Per-row validation applied on arrival:

| Check | Error message |
|---|---|
| `fullName` empty, missing, or < 2 chars | "Full name must be at least 2 characters" |
| `email` missing or invalid format | "Invalid or missing email" |
| `role` not one of `complainant`, `committee_member`, `manager` (case-insensitive) | "Invalid role — use: complainant, committee_member, or manager" |

- No max-length validation on any field — out of scope
- If the uploaded file has no `department` column at all, the Department cell renders as blank (empty string) for every row — no error
- Table columns: Row #, Full Name, Email, Role, Department, Status (✅ Valid / ❌ error message)
- Summary: "X valid, Y errors"
- **"Import X users"** button: disabled if 0 valid; invalid rows permanently skipped
- **"Back"** → reset to Step 1

---

**Step 3 — Importing**

- Loop through valid rows **truly sequentially**: `await` each `POST` before the next — do not use `Promise.all`
- Each row: `api.post('/users', { email, fullName, role, department?, password: 'Welcome@123' })`
- Progress: "X of M processed" with a progress bar
- Per-row live result: ✅ Created / ❌ "Email already registered" (409) / ❌ "Failed" (other errors)
- **"Done" button** rendered only after all M rows are processed
- Dialog close (Escape / backdrop) **disabled** during import; enabled again after all rows complete
- Done: close dialog, `invalidate(['users'])` → table refreshes
- No cancel/abort

---

**Excel Template:**
- Row 1 = header row (read by SheetJS)
- Column name matching case-insensitive
- `department` column optional — may be absent from the file entirely (treated as empty for all rows)

---

## Error Handling Summary

| Scenario | Location | Handling |
|---|---|---|
| Duplicate email (single) | AddUserDialog | `toast.error("Email already registered")` |
| Duplicate email (import) | Step 3 | Row ❌ "Email already registered", continue |
| Invalid role (import) | Step 2 | Row ❌, skipped |
| Missing required column | Step 1 | File-level error, stay on Step 1 |
| Zero data rows | Step 1 | File-level error |
| > 500 rows | Step 1 | File-level error |
| Network/server error (import) | Step 3 | Row ❌ "Failed", continue remaining |
| Server error non-409 (single) | AddUserDialog | `toast.error("Failed to create user")` |

---

## Files Changed / Created

### Backend
| File | Change |
|---|---|
| `src/modules/users/users.service.ts` | Add `findAll(): Promise<User[]>` → `return this.repo.find()` |
| `src/modules/users/users.controller.ts` | Add `@Get() @Roles(UserRole.ADMIN) findAll()` before existing handlers; method-level `@Roles` only |

### Frontend
| File | Change |
|---|---|
| `src/types/api.ts` | Add `department?: string; phone?: string` to `ApiUser` (fields exist on backend, missing from frontend type) |
| `src/hooks/useUsers.ts` | New — `useUsers()`, `useCreateUser()` |
| `src/pages/UserManagement.tsx` | New |
| `src/components/cms/AddUserDialog.tsx` | New |
| `src/components/cms/ImportUsersDialog.tsx` | New |
| `src/components/cms/AppSidebar.tsx` | Add `{ title: "Users", url: "/users", icon: Users }` to `navByRole.admin`; add `Users` to lucide-react named import |
| `src/App.tsx` | Add `AdminRoute` component; add `<Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />` as child of existing layout route |

### npm Dependency
```bash
cd frontend && npm install xlsx
```

---

## Out of Scope
- Editing or deactivating users
- Welcome emails / password reset
- Pagination on user table
- Import row cancellation mid-import
- `phone` field collection in UI
- Max-length validation on import rows
- Backend guard against creating `admin` role via `POST /users`
