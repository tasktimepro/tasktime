# Requirements

Requirement identifiers are stable references for acceptance criteria, design documents, and reviews.

## Data and compatibility

- **DATA-1:** Store application entities in Yjs documents persisted through IndexedDB.
- **DATA-2:** Read supported historical local, Drive, and backup shapes without requiring a user reset.
- **DATA-3:** Make persisted schema changes additive or provide an explicit, tested migration.
- **DATA-4:** Preserve entity relationships during normal mutations, cascade deletion, import, export, archive, and restore.
- **DATA-5:** Reject or safely normalize malformed external data without silently discarding valid records.
- **DATA-6:** A persisted collection or field is not complete until every applicable storage and product consumer has been reviewed: types, validation, compatibility/migration, sync/archive, backup/export, import/restore, deletion, reports, UI, agents, and historical regression fixtures. Intentional exclusions must be specified.

## Projects, clients, tasks, and planning

- **WORK-1:** Create, update, archive, restore, and explicitly delete projects and clients.
- **WORK-2:** Create tasks under projects with optional parent-task hierarchy; recurring behavior applies only to top-level tasks.
- **WORK-3:** Support list and kanban project task views, project notes, estimates, deadlines, budgets, colors, sorting, and quote mode where implemented.
- **WORK-4:** Plan clients, projects, tasks, and expenses by week/day without duplicating the referenced entity.
- **WORK-5:** Track daily and weekly goals using the user's week-start preference.

## Time tracking

- **TIME-1:** Permit multiple active timers across projects but at most one timer state per project.
- **TIME-2:** Starting, pausing, resuming, editing, clearing, and stopping timers must preserve elapsed-time semantics.
- **TIME-3:** Pausing must not create an entry; stopping must create exactly one time entry and clear the timer.
- **TIME-4:** Manual and timer-created entries must validate start/end ordering and remain consistent across UI, reports, invoices, imports, exports, and agent commands.
- **TIME-5:** Billing increments and billing snapshots must not mutate the underlying raw tracked interval.

## Expenses and tax

- **EXP-1:** Create, update, delete, categorize, filter, and mark expenses paid/unpaid.
- **EXP-2:** Support recurring-expense schedules with pause, resume, and deterministic occurrence handling.
- **EXP-3:** Track tax-return periods and explicit claimed/filed/paid state transitions.
- **EXP-4:** Preserve original currency, conversion information, supplier/project/client relationships, and invoice linkage where present.

## Invoices, quotes, and payments

- **BILL-1:** Preview and create invoice drafts from eligible unbilled time, task estimates/flat amounts, and selected expenses.
- **BILL-2:** Keep invoice calculations, line items, project breakdowns, rounding, tax, discounts, currency, and totals internally consistent.
- **BILL-3:** Finalization must apply billing state once and retain enough snapshots to explain and undo supported effects.
- **BILL-4:** Marking invoices paid/unpaid must preserve payment amount, date, method, and currency snapshot semantics.
- **BILL-5:** Undoing the latest supported invoice must restore eligible source state exactly once without damaging later unrelated work.
- **BILL-6:** Quotes must not create invoice billing records merely by previewing/exporting/sending them.
- **BILL-7:** PDF/email/export output must reflect the same finalized or preview data shown in the product.

## Reports and export/import

- **REPORT-1:** Report totals must derive from the same canonical time, expense, invoice, payment, tax, date, client, project, and currency semantics used elsewhere.
- **REPORT-2:** Filters and date ranges must apply consistently to on-screen summaries and exported CSV/PDF/accountant packs.
- **BACKUP-1:** Export a portable backup containing supported account data without secret credentials.
- **BACKUP-2:** Preview imports before mutation and restore valid supported backups without breaking relationships.
- **BACKUP-3:** Keep public compatibility fixtures and regression tests for representative older backup shapes.

## Sync and offline behavior

- **SYNC-1:** Keep core product behavior available offline and make connectivity state visible.
- **SYNC-2:** Preserve the manual, backup, and sync trigger matrix documented in `AGENTS.md`.
- **SYNC-3:** Keep normal Worker/Drive requests proportional to actual work. An unchanged/no-op sync uses manifest metadata, throttling, cooldowns, and cross-tab locking and must not list all app-data files, download documents, or upload state; heavier recovery requests require a correctness justification and request-count regression coverage.
- **SYNC-4:** Serialize cross-tab synchronization and recover disconnected dirty documents on reconnect.
- **SYNC-5:** Never auto-sync destructive resets or conflict decisions that can undo a valid change from another device.

## Agent access

- **AGENT-1:** Expose business actions through a loopback-only local MCP bridge; never expose raw Yjs/IndexedDB access.
- **AGENT-2:** Require explicit short-lived pairing, session management, scoped permissions, approvals for sensitive actions, revocation, and rate limiting.
- **AGENT-3:** Keep app-session tokens memory-only and exclude credentials from logs, files, docs, and recovery responses.
- **AGENT-4:** Every new or changed user-facing business action receives a UI/agent parity review. Supported actions use the same domain/application operation and keep behavior, validation, errors, permissions, approvals, tool schemas, generated docs, bundles, and published package metadata aligned; intentional exclusions are documented and not advertised as parity.
- **AGENT-5:** Support the long-running task/time flow across sessions: select/create task, start timer, allow work to continue, stop the same timer, and verify the created entry.

## UX, accessibility, and operations

- **UX-1:** Support desktop and mobile navigation for all primary product areas.
- **UX-2:** Provide explicit loading, empty, error, success, disabled, offline, and destructive states where relevant.
- **UX-3:** Use semantic, keyboard-operable, labeled controls with visible focus and non-color cues.
- **OPS-1:** Run development and release commands through Docker-backed Make targets.
- **OPS-2:** Keep public/private repository boundaries and environment documentation accurate.
- **OPS-3:** Run lint, coverage, browser smoke, PWA smoke, and build checks as the broad release gate.
- **OPS-4:** Review the persisted-data and cross-surface change impact matrix before completion; no consumer may be silently omitted.
