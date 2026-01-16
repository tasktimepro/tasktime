# Agent Instructions for TaskTime

> **Purpose:** Guidelines and context for AI agents working on this codebase  
> **Last Updated:** January 16, 2026

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
- **Storage:** IndexedDB (via `idb` package) — NOT localStorage
- **State:** Lifted state in App.jsx with custom hooks
- **Routing:** Path-based via `useUrlState` hook (e.g., `/projects`, `/clients/123`)

---

## 🏗️ Architecture Decisions

### URL Routing
- Path-based routing: `/`, `/projects`, `/projects/{id}`, `/clients`, `/clients/{id}`, `/invoices`, `/account`
- Query params only for secondary state: `?section=`, `?tab=`, `?create=`
- Custom `useUrlState` hook (not React Router)
- Supports browser back/forward navigation

### Storage: IndexedDB
- Use `idb` package (Jake Archibald's wrapper)
- Single database: `tasktime-db`
- Single object store: `app-data`
- Keys match old localStorage keys: `projects`, `tasks`, `timeEntries`, etc.
- Hook: `useIndexedDB` (async, returns loading state)

### State Management
- All app state lives in `App.jsx`
- Custom hooks for persistence (`useIndexedDB`)
- Props passed down (yes, there's prop drilling — acceptable for now)
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
│   └── invoice/    # Invoice-specific components
├── hooks/          # Custom React hooks
├── contexts/       # React contexts
├── utils/          # Pure utility functions
└── styles/         # CSS files
```

---

## ⚠️ Known Patterns to Follow

### Timer System
- Single active timer only (enforced)
- Timer state: `{ startTime, taskId, paused, elapsedTime, note }`
- Pause preserves elapsed time, doesn't create entry
- Stop creates the time entry

### Data Relationships
- Projects have `invoiceIds[]` (references, not embedded)
- Tasks have `projectId` and optional `parentTaskId`
- Time entries have `taskId`
- Invoices stored separately, referenced by ID

### Modal System
- `ModalManager.jsx` orchestrates all form modals
- Supports modal stacking (nested modals)
- Use `openXxxModal()` functions from App.jsx

---

## � Docker Development Environment

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

1. **Don't use localStorage** — We use IndexedDB now
2. **Don't add console.log** — Remove debug statements
3. **Don't create migration code** — We're pre-production
4. **Don't keep old code "just in case"** — Delete it
5. **Don't add backwards compatibility shims** — Clean breaks only
6. **Don't use class components** — Functional only
7. **Don't add new dependencies without justification** — Keep it lean
8. **Don't run npm directly** — Use `docker compose run --rm app npm ...`

---

## 📊 Current State (January 2026)

### ✅ Phase 1: Stabilization COMPLETE
- [x] Comprehensive project documentation (`docs/project_overview.md`)
- [x] Identified issues and improvements
- [x] **IndexedDB migration** (replaced localStorage)
  - Installed `idb` package
  - Created `useIndexedDB` hook with loading state
  - Updated `App.jsx` with loading screen
  - Deleted `useLocalStorage` hook
  - Removed dead code (onboarding, console.logs)
- [x] **Performance optimization** - Added `React.memo` to heavy components
  - Dashboard, InvoiceGenerator, TaskItem, TaskTree, GlobalTimer, TimerControls
- [x] **Error Boundaries** - Created `ErrorBoundary.jsx`
  - Wrapped all main views in App.jsx
  - User-friendly error fallback with retry option
- [x] **Time entry overlap validation** - Centralized in `TimerControls.jsx`
  - `createValidatedTimeEntry()` function validates before creating entries
  - Shows toast error if overlap detected
- [x] **Constants file** - Created `src/constants/app.js`
  - Centralized magic numbers (time, billing, UI constants)
  - Updated all components to use constants
- [x] **Debug code cleanup** - Removed all console.log statements
  - Cleaned 7 files: pdfUtils.js, currencyUtils.js, ModalManager.jsx, InvoicesList.jsx, Invoices.jsx, InvoiceGenerator.jsx, InvoiceHandler.js
- [x] **Fixed bugs**
  - Export/Import timer warning: Users now warned when importing with active timer
  - Removed unused `currentTime` state from TaskItem.jsx (dead code cleanup)
  - Currency conversion error handling with user warnings
  - Browser tab title race condition (using refs)
  - Consistent date handling utilities added
- [x] **Timer heartbeat auto-save** - Crash recovery improvement
  - Added `lastActive` timestamp to timer state
  - Periodic save every 30 seconds while timer is running
  - Added `TIMER_HEARTBEAT_INTERVAL_MS` constant

### 🔄 Phase 2: UI Migration (NEXT)
- [ ] shadcn/ui migration (see `docs/todo/shadcn-migration.md`)
- [ ] Component restructuring during migration
- [ ] Split large components as needed

### Future Phases
- [ ] Testing infrastructure (Jest + React Testing Library)
- [ ] TypeScript migration (gradual)
- [ ] Cloud features (Google OAuth, Drive backup, multi-device sync)

---

## 🔗 Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/project_overview.md` | Full technical documentation |
| `docs/client_edge_license_flow.md` | Future cloud/license architecture |
| `_implan.md` | Original project plan and preferences |
| `README.md` | User-facing documentation |

---

## 💡 Tips for Future Sessions

1. **Read `docs/project_overview.md` first** — It has the full architecture
2. **Check this file for rules** — Especially the "no legacy code" rule
3. **App.jsx is the state hub** — All data flows from there
4. **Large components exist** — InvoiceGenerator.jsx (1589 lines), Dashboard.jsx (1201 lines)
5. **Test in browser** — localStorage → IndexedDB won't auto-migrate, clear data if needed

---

*This file should be updated when major architectural decisions are made.*
