# Agent Instructions for TaskTime Pro

> **Purpose:** Guidelines and context for AI agents working on this codebase  
> **Last Updated:** July 10, 2026

---

## 🚨 Critical Rules

### Development Phase Status: PRODUCTION

**This project has users in production. Therefore:**

1. **Backwards compatibility is mandatory** — Existing local and synced Yjs data must keep working
2. **No destructive schema changes without migration** — Add optional fields first, migrate safely, and preserve old data
3. **No user-data reset assumptions** — Users must not be expected to clear browser data or Drive sync state
4. **No clean breaks in persisted contracts** — Entity shapes, document names, sync metadata, and URL routes need compatibility handling
5. **No automatic destructive sync actions** — Resets, claim states, archive moves, and billing mutations must be explicit and reversible where practical
6. **Legacy code can be removed only after migration** — Delete old implementations after the replacement safely handles existing data
7. **Per-file test coverage ≥ 70%** — For `src/hooks/**` and `src/utils/**`, each file must meet at least 75% coverage

---

## Agent Workflow

Before changing code, read the sources that govern the area being changed:

1. This file, then `status/_status.md` and the relevant layer status file
2. `SYSTEM_OVERVIEW.md` and `ARCHITECTURE_MAP.md`
3. `spec/requirements.md`, `spec/acceptance.md`, and the relevant feature/design specifications
4. Relevant files under `contracts/` and `rules/`, especially `rules/domain-invariants.md`
5. Relevant sections of `README.md`, `CONTRIBUTING.md`, and operational documentation under `docs/`
6. Existing tests and behavior comments beside the code being changed
7. A matching workflow under `.agents/skills/` when one applies

`AGENTS.md` and the project-specific rules are authoritative. The reusable skills and prompts support those rules; they do not override TaskTime Pro's production compatibility requirements.

For behavior changes, use red/green discipline: first add or update a test that demonstrates the required behavior, verify that it fails for the intended reason, implement the smallest compatible change, then run the focused test and the relevant broader Docker-backed gate. Update docs and comments when a contract, workflow, or non-obvious invariant changes.

Ongoing agent workflows are available in `.github/prompts/`. `status/` is the execution work register; `TODO.md` is the broader backlog and ideas list. Update the relevant status file when a tracked slice materially changes state.

**Authority rule:** `spec/`, `contracts/`, and `rules/` are project source of truth. `SYSTEM_OVERVIEW.md` and `ARCHITECTURE_MAP.md` compress that context and must be reconciled when architecture or workflows change. If source, tests, and specifications disagree, investigate and reconcile the drift rather than silently choosing the most convenient version.

---

## 📁 Project Overview

**TaskTime Pro** is a local-first task time tracking and invoicing app.

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Storage:** Yjs CRDT with IndexedDB persistence (via `y-indexeddb`)
- **State:** Yjs-backed React hooks in App.jsx
- **Routing:** Path-based via `useUrlState` hook (e.g., `/projects`, `/clients/123`)
- **Sync:** Yjs + Google Drive (delta-based, conflict-free)

---

## 🏗️ Architecture Decisions

### URL Routing
- Path-based routing: `/`, `/projects`, `/projects/{id}`, `/clients`, `/clients/{id}`, `/invoices`, `/reports`, `/expenses`, `/account`
- Query params only for secondary state: `?section=`, `?tab=`, `?create=`
- Custom `useUrlState` hook (not React Router)
- Supports browser back/forward navigation

### Storage: Yjs CRDT
- **Engine:** Yjs for conflict-free sync
- **Persistence:** y-indexeddb for local storage
- **Multi-doc architecture:** Data split by type/time period
- **Sync provider:** Google Drive (delta uploads)

### Schema Changes & Cloud Sync (Production)
- Schema changes must be additive or include an explicit migration path.
- Existing IndexedDB and Google Drive state must be considered live customer data.
- Old cloud state can reintroduce incompatible records after local changes; compatibility must be handled in validation, migrations, and sync code.
- Test schema changes against realistic existing local and Drive-backed data before release.
- Never auto-sync destructive resets across devices.

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

**TaskTime Pro uses Yjs for conflict-free sync.** The system is in `src/stores/yjs/`:

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

**Sync Behavior Rules (definitive):**

Three auto-sync modes exist: `manual`, `backup`, `sync`. Each has distinct trigger behavior:

| Trigger | Manual | Backup | Sync |
|---------|--------|--------|------|
| **Local edit** | No auto-sync | Push-only (debounced 100ms) | Push-only (debounced 100ms) |
| **Tab focus** | No auto-sync | Push pending local changes only | Full pull+push (60s cooldown) |
| **Network online** | No auto-sync | Push pending local changes only | Full pull+push (60s cooldown) |
| **Periodic interval** | None | None | Every 15 minutes (pull+push) |
| **Page reload** | Connect only, except a pristine first device may do one bootstrap pull | Full pull+push on connect | Full pull+push on connect |
| **"Sync Now" button** | Full pull+push (force) | Full pull+push (force) | Full pull+push (force) |
| **Reconnect after disconnect** | Connect only (no sync) | Push dirty docs on connect | Push dirty docs on connect |

**Key rules:**
- **Backup = push-only by default.** No automatic pulling of remote changes. Users must click "Sync Now" or reload to get remote changes.
- **Sync = full bidirectional.** Pulls + pushes on all triggers with cooldowns.
- **Manual = user-controlled.** Only "Sync Now" triggers sync after setup. Page reload and reconnect normally only establish the Drive connection without pulling or pushing, except a pristine first device may do one bootstrap pull so existing Drive data appears immediately.
- **Pull efficiency:** Before downloading, a lightweight `modifiedTime` metadata check determines if the manifest changed. No download if unchanged.
- **Pull throttle:** 30 seconds — skips manifest reload if no local changes and last pull was recent.
- **Foreground request budget:** A clean focus/online event inside the 60-second cooldown makes zero Worker/Drive requests. Once stale, an unchanged clean check makes one manifest-metadata request, advances the local cooldown, and performs no document transfer, manifest save, backup listing, or full app-data listing.
- **Cross-tab lock:** Web Locks API prevents duplicate syncs across tabs.
- **Page-exit serialization:** Hiding or exiting during an active sync does not enqueue a second forced pass.
- **Reconnect push:** Dirty docs are tracked by document name in localStorage and only those docs are pushed as full-state on next connect regardless of mode. Pull/consistency retries remain separate from local-dirty evidence; legacy boolean-only markers are conservatively supported.
- **Idempotent reconciliation:** Archive and persisted-record reconciliation emits no Yjs update after records are already settled.
- **Never auto-sync destructive resets across devices** — e.g., `resetExpiredSkips` must not undo a valid skip from another device.

### 🔐 Google Drive Auth - Cloudflare Worker

**Token persistence is handled by a Cloudflare Worker** to solve OAuth token expiry:

- **Worker URL:** `https://sync.tasktime.pro`
- **Source:** private operational Worker source. The public repository mirror intentionally excludes this implementation.
- **Features:** Secure refresh token storage, auto-refresh, Drive API proxy

**How it works:**
1. OAuth popup → Worker exchanges code for tokens
2. Worker encrypts and stores refresh token in KV
3. Worker returns session ID to app (stored in localStorage)
4. All Drive API calls go through Worker with session ID
5. Worker auto-refreshes access tokens as needed

**Worker operations:** Deployment, logs, D1/KV commands, and secret management live in the private infrastructure repository, not in the public app Makefile.

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
3. **Don't skip migration code** — Production data must remain readable
4. **Don't keep old code "just in case"** — Delete it
5. **Don't break persisted data contracts** — Add compatibility handling or migrations
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
- [x] Cloudflare Worker deployed (private operational source; excluded from the public mirror)
- [x] Worker-based auth flow (OAuth popup → Worker proxy)
- [x] Encrypted refresh token storage in Cloudflare KV

### Next Steps
- [ ] TypeScript migration (gradual)
- [ ] Testing infrastructure improvements

---

## 🔗 Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/agent-release-runbook.md` | Local MCP bridge, ClawHub skill, OpenClaw bundle, and Claude plugin publishing workflow |
| `_implan.md` | Original project plan and preferences |
| `README.md` | User-facing documentation |
| `rules/` | Detailed engineering, testing, design, Docker, hardening, and domain constraints |
| `.agents/skills/` | Reusable workflows for planning, implementation, review, and handoff |
| `SYSTEM_OVERVIEW.md` | Compressed runtime, data, workflow, reliability, and security model |
| `ARCHITECTURE_MAP.md` | Module boundaries, dependency direction, and change hotspots |
| `spec/` | Product intent, requirements, acceptance, architecture, UX, features, roadmap, and ambiguities |
| `contracts/` | Durable public interfaces and persisted data schemas |
| `status/` | Current cross-layer execution state and handoff detail |

---

## 💡 Tips for Future Sessions

1. **Check this file for rules** — Especially the "no legacy code" rule
2. **App.jsx uses Yjs hooks** — All state is managed by Yjs
3. **Keep tests updated** — Add or adjust tests whenever behavior changes
4. **Use Yjs hooks directly** — `useProjects()`, `useTasks()`, etc. from `src/hooks/`
5. **Subtasks cannot be recurring** — The project UI disallows recurring subtasks; avoid adding recurring-specific logic to subtask components.
6. **Keep the context layer current** — Update specifications, contracts, overview/map, and status when their governed behavior changes.

---

*This file should be updated when major architectural decisions are made.*

<!-- debugbundle:start -->
## DebugBundle
- Use DebugBundle for runtime failures, production/customer-facing incidents, endpoint downtime, notification/webhook delivery failures, health-check failures, specific incident reports, or symptoms likely to have generated captured events.
- For deterministic local code, UI, layout, copy, calculation, refactor, or test-only issues, inspect source and tests first; do not check DebugBundle incidents unless runtime evidence is needed or the user asks.
- Read `.agents/skills/debugbundle/SKILL.md` for the full DebugBundle workflow.
<!-- debugbundle:end -->
