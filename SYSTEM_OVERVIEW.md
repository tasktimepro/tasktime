# TaskTime Pro System Overview

TaskTime Pro is a production, local-first task management, time tracking, expense, reporting, and invoicing application for freelancers and solo professionals. The browser owns user data and business mutations. Optional services add Drive synchronization, push notifications, diagnostics, public documentation, and same-device agent access.

This is a context-compression document. Detailed requirements live in `spec/`, durable interfaces in `contracts/`, and mandatory constraints in `rules/`.

## Runtime components

- **Browser app:** React 19/Vite PWA under `src/`. It provides all product screens and owns Yjs-backed mutations.
- **Local persistence:** Yjs documents persisted to IndexedDB through `y-indexeddb`.
- **Drive sync:** `src/stores/yjs/providers/` synchronizes Yjs updates through the public `https://sync.tasktime.pro` Worker interface. The private Worker implementation is outside this repository.
- **Agent command layer:** `src/agent/commands/` exposes validated business actions over the browser bridge context.
- **Local MCP bridge:** `src/agent/bridge/` and the built `@tasktimepro/agent-bridge` package provide loopback-only, explicitly paired agent access.
- **Public site:** Astro content under `blog/` builds the blog, legal pages, agent documentation, discovery metadata, and generated tool references.
- **Operational evidence:** DebugBundle captures opted-in runtime incident evidence; local tests remain the first tool for deterministic failures.

## Data model and ownership

The Yjs store is split into documents so current work stays loaded and historical data can load on demand:

| Document | Responsibility |
|---|---|
| `core` | Projects, active tasks, clients, settings/templates, current invoices, and the internal replay-safe invoice billing-operation journal |
| `entries-active` | Recent time entries |
| `entries-{year}` | Historical time entries by year |
| `tasks-archived` | Archived tasks |
| `expenses-archived` | Archived expenses |
| `invoices-archived` | Archived/older invoices |

`src/stores/yjs/types.ts` defines current TypeScript shapes and `src/stores/yjs/validation.ts` validates current and supported historical data. Existing IndexedDB, Drive, and backup data are live customer contracts.

## Main user flows

1. Create clients and projects, organize tasks/subtasks, and plan work by week.
2. Start, pause, resume, and stop one timer per project; stopping creates one time entry.
3. Record expenses and recurrences, organize tax-return periods, and track paid/claimed states.
4. Generate invoice drafts or quotes from unbilled work and expenses, finalize them, record payments, export/send documents, and undo supported billing operations.
5. Review dashboard metrics and reports, then export CSV, PDF, ZIP, backup, or accountant artifacts.
6. Optionally connect Google Drive using manual, backup, or bidirectional sync modes.
7. Optionally pair a same-device agent bridge and grant scoped business-action access.

## Reliability and security model

- Local data remains usable offline; cloud features are optional.
- Schema changes are additive or explicitly migrated and tested against historical data.
- UI badges, invoice composition, and agent invoice commands share the same read-only eligibility operation, including conservative support for finalized legacy invoices with markerless source entries.
- UI hooks and agent commands share domain operations for timer lifecycle/recovered stops, protected manual time-entry mutations, task completion/recurrence state, duplicate-safe entity identity, protected expense deletion, and relationship-safe project/client/task writes.
- Automatic recurring-task status reads never clear persisted skip evidence; paid cross-currency expense mutations prepare snapshots before committing; canonical agent unbilled queries load complete local history.
- Sync mode trigger semantics in `AGENTS.md` are durable behavior.
- Destructive data, billing, deletion, and sync actions require explicit intent and safe preview/confirmation where available.
- Agent access is loopback-only with short-lived pairing, scoped permissions, approvals, rate limits, revocation, and memory-only session credentials.
- Private Worker source, secrets, provider identifiers, and internal operational material do not enter the public repository.

## Development and verification

All Node/npm work runs through Docker-backed Make targets. Vitest tests are colocated throughout `src/`; integration tests live in `src/test/integration/`; Playwright browser flows live in `e2e/`. Repository-wide TypeScript checking is a required release gate, and CI runs `make release-gate`.

See `ARCHITECTURE_MAP.md` for module navigation, `spec/roadmap.md` and `status/_status.md` for current work, and `spec/ambiguities.md` for unresolved decisions.
