# Agent Instructions for TaskTime

> **Purpose:** Guidelines and context for AI agents working on this codebase  
> **Last Updated:** January 20, 2026

---

## 🚨 Critical Rules

### Development Phase Status: PRE-PRODUCTION

**This project is NOT in production. Therefore:**

1. **NO backwards compatibility** — Break things freely when improving
2. **NO legacy code** — Remove old implementations entirely, don't keep both
3. **NO migration paths** — Users can clear browser data if needed
4. **NO workarounds for old patterns** — Clean implementations only
5. **NO deprecated code comments** — Delete, don't comment out

### When This Changes
- These rules apply until first public release
- Before going to production: revisit this document
- After production: backwards compatibility becomes mandatory

---

## 📁 Project Overview

**TaskTime** is a local-first task time tracking and invoicing app.

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Storage:** Yjs CRDT with IndexedDB persistence (via `y-indexeddb`)
- **State:** Yjs-backed React hooks in App.jsx
- **Routing:** Path-based via `useUrlState` hook (e.g., `/projects`, `/clients/123`)
- **Sync:** Yjs + Google Drive (delta-based, conflict-free)

---

## 🏗️ Architecture Decisions

### URL Routing
- Path-based routing: `/`, `/projects`, `/projects/{id}`, `/clients`, `/clients/{id}`, `/invoices`, `/account`
- Query params only for secondary state: `?section=`, `?tab=`, `?create=`
- Custom `useUrlState` hook (not React Router)
- Supports browser back/forward navigation

### Storage: Yjs CRDT
- **Engine:** Yjs for conflict-free sync
- **Persistence:** y-indexeddb for local storage
- **Multi-doc architecture:** Data split by type/time period
- **Sync provider:** Google Drive (delta uploads)

### Schema Changes & Cloud Sync (Pre‑Production)
- When changing document structure, ensure Drive data is cleared or isolated before testing.
- Old cloud state can reintroduce incompatible records after a local wipe.
- For production, plan explicit schema/versioning and server-side migration safeguards.

**Document structure:**
| Document | Contents | Loading |
|----------|----------|---------|
| `core` | projects, tasks, clients, businessInfos, templates | Always |
| `entries-active` | Last 90 days of time entries | Always |
| `entries-{year}` | Historical entries by year | On-demand |
| `tasks-archived` | Archived tasks | On-demand |
| `invoices-archived` | Paid invoices from past years | On-demand |

### State Management
- All app state powered by Yjs hooks
- Entity hooks: `useProjects()`, `useTasks()`, `useTimeEntries()`, `useTimers()`, etc.
- **All components now use hooks directly** - no prop drilling for mutations
- Timer/task components fully migrated to hooks (TimerControls, GlobalTimer, TaskTree, TaskItem, etc.)
- Invoice components fully migrated (InvoiceGenerator, InvoicesList use Yjs hooks)
- Account/Settings fully migrated (usePreferences, useYjs().clearAllData)
- Toast notifications via `ToastContext`

### Component Patterns
- Functional components only
- Hooks for all logic
- PropTypes for validation (TypeScript migration planned)
- Tailwind for styling (no CSS modules)

---

## 📋 Code Style

### Formatting
- 4-space indentation (per project preference in `_implan.md`)
- Empty line after opening braces `{`
- Empty line after semicolons in logical sections
- JSDoc comments on functions

### Naming
- Components: PascalCase (`TaskItem.jsx`)
- Hooks: camelCase with `use` prefix (`useIndexedDB.js`)
- Utilities: camelCase (`dateUtils.js`)
- Constants: SCREAMING_SNAKE_CASE

### File Organization
```
src/
├── components/     # React components
│   ├── modals/     # Modal components
│   ├── invoice/    # Invoice-specific components
│   └── sync/       # Sync status/settings (Yjs)
├── hooks/          # Custom React hooks (Yjs entity hooks)
├── contexts/       # React contexts (Toast, Yjs)
├── stores/yjs/     # Yjs store, doc manager, providers
├── utils/          # Pure utility functions
├── types/          # TypeScript declarations
└── styles/         # CSS files
```

---

## Known Patterns to Follow

### Timer System
- Multiple active timers across projects (one per project)
- Timer state managed by `useTimers()` hook
- Pause preserves elapsed time, doesn't create entry
- Stop creates the time entry automatically

### Data Relationships
- Projects have `invoiceIds[]` (references, not embedded)
- Tasks have `projectId` and optional `parentTaskId`
- Time entries have `taskId`
- Invoices stored separately, referenced by ID

### Modal System
- `ModalManager.jsx` orchestrates all form modals
- Supports modal stacking (nested modals)
- Use `openXxxModal()` functions from App.jsx

### 🔄 Sync System - Yjs (ACTIVE)

**TaskTime uses Yjs for conflict-free sync.** The system is in `src/stores/yjs/`:

- **CRDT-based sync** - Conflicts resolved automatically by Yjs
- **Multi-document architecture** - Data split for scaling
- **Delta-based uploads** - Only changes sync, not full state
- **Automatic archival** - Old entries archived by year

**Hooks (in `src/hooks/`):**
```typescript
const { projects, createProject, updateProject, deleteProject } = useProjects();
const { tasks, createTask, updateTask, archiveTask } = useTasks();
const { entries, createEntry, loadYear } = useTimeEntries();
const { timers, startTimer, stopTimer, pauseTimer } = useTimers();
const { clients, createClient } = useClients();
const { invoices, createInvoice } = useInvoices();
const { preferences, updatePreferences } = usePreferences();
```

**Key files:**
- `src/stores/yjs/YjsStore.ts` - Main store facade
- `src/stores/yjs/YjsDocManager.ts` - Multi-doc management
- `src/contexts/YjsContext.tsx` - React context provider
- `src/hooks/use*.ts` - Entity-specific hooks
- `src/components/sync/YjsSyncStatus.tsx` - Status indicator
- `src/components/sync/YjsSyncSettings.tsx` - Settings panel

**Sync Behavior (Jan 22, 2026 optimizations):**
- **Sync interval:** 60 seconds (reduced from 15s to minimize Cloudflare requests)
- **Pull throttle:** 30 seconds - skips manifest reload if no local changes and last pull was recent
- **Manifest change check:** Before full download, checks `modifiedTime` via metadata request
- **Force sync triggers:** Tab visibility change, network online event (always bypass throttle)
- **Fallback file lookup:** If delta file not in cache, searches Drive directly

### 🔐 Google Drive Auth - Cloudflare Worker

**Token persistence is handled by a Cloudflare Worker** to solve OAuth token expiry:

- **Worker URL:** `https://tasktime-sync.owenfar1.workers.dev`
- **Source:** `cloudflare/` folder (TypeScript, no node_modules)
- **Features:** Secure refresh token storage, auto-refresh, Drive API proxy

**How it works:**
1. OAuth popup → Worker exchanges code for tokens
2. Worker encrypts and stores refresh token in KV
3. Worker returns session ID to app (stored in localStorage)
4. All Drive API calls go through Worker with session ID
5. Worker auto-refreshes access tokens as needed

**Worker commands (Makefile):**
```bash
make worker-deploy    # Deploy Worker (requires CLOUDFLARE_API_TOKEN env var)
make worker-logs      # View Worker logs
make worker-secret    # Set a secret (KEY=... VALUE=...)
```

**Local development:** Set `VITE_SYNC_WORKER_URL` in `.env.local`

---

## 🐳 Docker Development Environment

**All npm/node commands run through Docker, NOT locally.**
### Quick Commands (Makefile)

```bash
make dev          # Start dev server (http://localhost:3101)
make stop         # Stop dev server
make build        # Production build
make install      # Install dependencies
make add PKG=idb  # Add a package
make lint         # Run ESLint
make logs         # View container logs
make shell        # Open shell in container
make clean        # Full rebuild (after package.json changes)
make npm CMD="run test"  # Run arbitrary npm command
```

### Raw Docker Commands (if needed)
```bash
# Install a package
docker compose run --rm app npm install <package>

# Run dev server
docker compose up

# Run any npm script
docker compose run --rm app npm run <script>
```

**Do NOT run `npm` directly** — it won't work (npm not installed on host).

---

## 🚫 Things to Avoid

1. **Don't use localStorage** — We use Yjs + IndexedDB
2. **Don't add console.log** — Remove debug statements
3. **Don't create migration code** — We're pre-production
4. **Don't keep old code "just in case"** — Delete it
5. **Don't add backwards compatibility shims** — Clean breaks only
6. **Don't use class components** — Functional only
7. **Don't add new dependencies without justification** — Keep it lean
8. **Don't run npm directly** — Use `docker compose run --rm app npm ...`
9. **Use Yjs hooks** — `useProjects()`, `useTasks()`, etc. for all data access
10. **Don't create new useIndexedDB calls** — All new state should use Yjs
11. **File deletions must be triggered via CLI** — Use a terminal delete command so you can approve it

---

## 📊 Current State (January 2026)

### Completed
- [x] Yjs sync system (Phases 1-6: core, Drive provider, React hooks, App migration, sync reliability, component migration)
- [x] Phase 7: Token persistence with Cloudflare Workers
- [x] Phase 8: Sync optimizations (60s interval, pull throttle, manifest change check, fallback file lookup)
- [x] App.jsx fully migrated to Yjs hooks
- [x] Old SyncEngine removed
- [x] YjsSyncStatus and YjsSyncSettings components
- [x] Timer components migrated (TimerControls, TaskTimer, GlobalTimer)
- [x] Task components migrated (TaskTree, TaskItem, TaskActions, SubtaskSection, SubtaskItem)
- [x] TimeEntriesModal migrated to Yjs hooks
- [x] InvoiceGenerator migrated to Yjs hooks
- [x] InvoicesList migrated to Yjs hooks
- [x] ProjectList/ClientList cascade deletes migrated to Yjs hooks
- [x] Account clear data migrated to use Yjs store clearAllData()
- [x] Preferences migrated to usePreferences() hook
- [x] ExportImport migrated to useTimers() hook
- [x] PaymentMethods, BusinessInfo, InvoiceTemplates migrated to Yjs hooks
- [x] Dashboard and RecentTasks migrated to Yjs hooks
- [x] useTaskState migrated to Yjs hooks
- [x] `syncableEntity.ts` deleted (no longer needed)
- [x] Cloudflare Worker deployed (`cloudflare/` folder)
- [x] Worker-based auth flow (OAuth popup → Worker proxy)
- [x] Encrypted refresh token storage in Cloudflare KV

### Next Steps
- [ ] TypeScript migration (gradual)
- [ ] Testing infrastructure improvements

---

## 🔗 Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/project_overview.md` | Full technical documentation |
| `docs/yjs-sync-implementation-plan.md` | Yjs sync architecture |
| `_implan.md` | Original project plan and preferences |
| `README.md` | User-facing documentation |

---

## 💡 Tips for Future Sessions

1. **Read `docs/project_overview.md` first** — It has the full architecture
2. **Check this file for rules** — Especially the "no legacy code" rule
3. **App.jsx uses Yjs hooks** — All state is managed by Yjs
4. **Keep tests updated** — Add or adjust tests whenever behavior changes
5. **Use Yjs hooks directly** — `useProjects()`, `useTasks()`, etc. from `src/hooks/`
6. **Review `docs/yjs-sync-implementation-plan.md`** — Understand the CRDT-based sync system
7. **Subtasks cannot be recurring** — The project UI disallows recurring subtasks; avoid adding recurring-specific logic to subtask components.

---

*This file should be updated when major architectural decisions are made.*
