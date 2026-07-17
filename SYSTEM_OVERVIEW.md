# TaskTime Pro System Overview

TaskTime Pro is a production, local-first task management, time tracking, expense, reporting, and invoicing application for freelancers and solo professionals. The browser owns user data and business mutations. Optional services add Drive synchronization, push notifications, diagnostics, public documentation, and same-device agent access.

This is a context-compression document. Detailed requirements live in `spec/`, durable interfaces in `contracts/`, and mandatory constraints in `rules/`.

## Runtime components

- **Browser app:** React 19/Vite PWA under `src/`. It provides all product screens and owns Yjs-backed mutations.
- **Local persistence:** Yjs documents persisted to IndexedDB through `y-indexeddb`.
- **Drive sync:** The `v1.3.1` PWA uses direct browser-to-Google Drive requests with a short-lived memory-only access token by default. The public `https://sync.tasktime.pro` Worker retains OAuth code exchange, encrypted refresh-token storage, token issuance, revocation, and a compatibility proxy. Production selection is additionally gated by a non-secret PWA build identifier, so older installed clients fail closed to the proxy until updated. The private Worker implementation is outside this repository.
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
4. Generate invoice drafts or quotes from unbilled work and expenses, finalize them, record payments, cancel finalized unpaid invoices as retained audit records, export/send valid documents, and undo supported billing operations.
5. Review dashboard metrics and reports, then export CSV, PDF, ZIP, backup, or accountant artifacts.
6. Optionally connect Google Drive using manual, backup, or bidirectional sync modes.
7. Optionally pair a same-device agent bridge and grant scoped business-action access.

## Reliability and security model

- Local data remains usable offline; cloud features are optional.
- Schema changes are additive or explicitly migrated and tested against historical data.
- UI badges, invoice composition, and agent invoice commands share the same read-only eligibility operation, including conservative support for finalized legacy invoices with markerless source entries.
- Browser and agent cancellation adapters share one journaled source-release operation. Cancellation revalidates current eligibility before the first journal write; retains the invoice number, original snapshots, and project links; releases only sources still owned by that invoice across active/historical/archive documents; never rewinds numbering; and conditionally converges late-arriving same-invoice claims after partial failure or stale Drive/archive replay without overwriting later billing.
- Canceled invoices remain read-only audit records in `core`, are unmistakably marked in retained PDFs, and contribute zero to payment, revenue, output-tax, profit, outstanding, aging, statement, and project-allocation calculations. Portable backup `1.5` preserves the record while continuing to import every previously supported backup version.
- Mark-as-unpaid is a paid-invoice correction only: it clears payment evidence while retaining billing-source claims and cannot reopen a sent, overdue, draft, or canceled invoice.
- UI hooks and agent commands share domain operations for timer lifecycle/recovered stops, protected manual time-entry mutations, task completion/recurrence state, duplicate-safe entity identity, protected expense deletion, and relationship-safe project/client/task writes.
- Automatic recurring-task status reads never clear persisted skip evidence; paid cross-currency expense mutations prepare snapshots before committing; canonical agent unbilled queries load complete local history.
- Sync mode trigger semantics in `AGENTS.md` are durable behavior.
- Google-grant revocation is confirmed before the browser clears its Worker session; transient refresh, rate-limit, Drive-status, and revocation failures preserve retryable credentials, while explicit local disconnect remains separate.
- Direct transport keeps Google access tokens in one per-tab module instance only, clears them on expiry/session generation/cross-tab invalidation/rollback, removes any retired persisted-token record, deduplicates concurrent same-tab session validation, and keeps all Worker/Google API traffic outside service-worker Cache Storage. Transport is explicit and fixed for one connection; missing/invalid/disabled policy selects the proxy, while direct reads/writes use retry-safe Google operations without mid-pass proxy replay. The Worker does not receive routine Drive file bodies for a connection selected for direct transport; the retained proxy remains available for compatibility and rollback.
- Destructive data, billing, deletion, and sync actions require explicit intent and safe preview/confirmation where available.
- Agent access is loopback-only with short-lived pairing, scoped permissions, approvals, rate limits, revocation, and memory-only session credentials.
- Private Worker source, secrets, provider identifiers, and internal operational material do not enter the public repository.

## Development and verification

All Node/npm work runs through Docker-backed Make targets. Vitest tests are colocated throughout `src/`; integration tests live in `src/test/integration/`; Playwright browser flows live in `e2e/`. Repository-wide TypeScript checking is a required release gate, and CI runs `make release-gate`.

See `ARCHITECTURE_MAP.md` for module navigation, `spec/roadmap.md` and `status/_status.md` for current work, and `spec/ambiguities.md` for unresolved decisions.
