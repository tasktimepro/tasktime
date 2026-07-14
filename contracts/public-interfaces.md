# Public Interfaces

These interfaces are durable boundaries. Implementation types, validation, generated catalogs, and tests must remain aligned with this contract.

## Browser application routes

The stable route surface is defined in `spec/routes.md`. Navigation uses History API state through `useUrlState`; route changes must preserve reload and back/forward behavior and must not capture public Astro routes.

## React data APIs

Components obtain product state and mutations through entity hooks under `src/hooks/`, including projects, clients, tasks, time entries, timers, invoices, expenses/recurrences/categories, tax periods, business information/assets, payment/invoice/email templates, preferences, notes, planner attachments, goals, and sync/auth behavior.

Callers must not create a second persistence layer. Hook return shapes may evolve additively, but established mutation semantics and persisted effects are durable.

`useTimers` is the browser timer-lifecycle boundary, including stop recovery and timer-created entry snapshots; `stopTimer` resolves asynchronously after complete-history validation/recovery. `useTimeEntries` keeps generic internal CRUD for controlled billing/deletion applications and exposes asynchronous protected manual-entry mutations for user-facing create/edit/delete flows so historical documents and archived task relationships are loaded before mutation. Project, client, and task hooks validate relationship-bearing writes through the same domain contracts used by agent commands; persisted entity IDs are immutable and create operations reject an existing ID before writing.

`useExpenses` retains synchronous raw create/update methods for controlled internal applications, while user-facing paid or payment-sensitive mutations use `createExpenseWithPaymentSnapshot` and `updateExpenseWithPaymentSnapshot`. Those asynchronous methods prepare required cross-currency evidence before committing. `deleteExpense` rejects billed/invoice-linked and tax-claimed expenses on every UI call path.

## Persisted Yjs boundary

- Managed document names: `core`, `entries-active`, `entries-{year}`, `tasks-archived`, `expenses-archived`, `invoices-archived`.
- Collection/entity contracts: `contracts/data-schemas.md`.
- Unknown additional entity fields are tolerated where validation uses passthrough, enabling forward/legacy compatibility.
- Cross-document operations must remain safe under replay, partial completion, reconnect, and concurrent-device updates.

## Backup JSON

Current export version: `1.4`.

Supported import versions: `1.0`, `1.1`, `1.3`, `1.4`.

Top-level payload:

```text
version: string
exportDate: ISO-8601 string
backupType?: automatic | manual
projects: Project[]
tasks: Task[]
timeEntries: TimeEntry[]
invoices: Invoice[]
paymentMethods: PaymentMethod[]
expenseCategories?: ExpenseCategory[]
taxReturnPeriods?: TaxReturnPeriod[]
businessInfos: BusinessInfo[]
businessBrandAssets: BusinessBrandAsset[]
clients: Client[]
invoiceTemplates: InvoiceTemplate[]
emailTemplates: EmailTemplate[]
expenses: Expense[]
expenseRecurrences: ExpenseRecurrence[]
dailyGoals: DailyGoal[]
plannerAttachments: PlannerAttachment[]
preferences: Preferences
```

Imports validate version, container types, unique identifiers, time ranges, task hierarchy/project references, time-entry task references, and project invoice references before mutation. Missing collections supported by historical versions normalize to empty arrays/default objects. Credentials and Drive/agent sessions are never exported.

Replacement restore is journaled outside the managed Yjs databases before any
destructive mutation. The journal includes the prior workspace and active
timers, is cleared only after a persistence barrier, and is recovered on the
next startup if the restore was interrupted.

## Sync Worker HTTP boundary

Configured by `VITE_SYNC_WORKER_URL`. Public client endpoint families are:

- `/auth/init`, `/auth/callback`, `/auth/revoke`, `/auth/status`
- `/drive`
- `/metrics/batch`
- `/push/vapid-public-key`, `/push/subscription`, `/push/schedules`, `/push/test`

The Worker owns OAuth refresh-token persistence and Drive API proxying. The browser owns product data semantics. Errors exposed to the browser must be sanitized; private deployment/KV/D1 details are not part of this public contract.

## Browser-to-bridge command protocol

Agent command results are discriminated responses:

```text
Success: { ok: true, command: string, data: T }
Failure: { ok: false, command: string, error: { code, message, details? } }
```

Error codes: `APP_NOT_READY`, `NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `PERMISSION_DENIED`, `RATE_LIMITED`, `UNAVAILABLE`.

Permission scopes: `read`, `write`, `billing`, `export`, `email`, `navigation`.

Pairing launch URLs carry the requested scopes so TaskTime Pro can display them before the user approves the connection. Persistent approval grants are keyed to the configured stable agent ID and must not authorize a bridge process presenting a different agent identity, even when the requested scopes otherwise match.

Command groups include:

- projects, clients, tasks, cascade previews/deletions, archives
- timers and time entries
- planner attachments, goals, and project notes
- expenses, recurrences, categories, and tax periods
- invoice/quote preview, drafts, finalization, payments, undo, PDF, and email
- business information/assets, payment methods, invoice/email templates, preferences
- reports, accountant/export outputs, dashboards, and unbilled queries
- Drive sync/backup/import/account data operations
- application navigation

The authoritative command-name/metadata catalog is generated from `src/agent/commands/registry.ts`. A command may additionally require explicit TaskTime approval and idempotency/confirmation data. Changes require synchronized tool schemas, bridge package, bundles, public docs, and tests.

`stop_timer` accepts an optional `idempotencyKey` and also converges concurrent stops through deterministic timer-instance entry identity. Manual time-entry commands validate complete local history and source/target billing rules before mutation. Generic `update_task` requests are normalized through task-state invariants; recurring completion still requires the occurrence-aware `complete_task` command. Create commands return `CONFLICT` for an existing persisted ID and must not replace the prior record.

`find_unbilled_time`, dashboard/project unbilled summaries, and recent-entry billing state load complete local task, time-entry, and invoice history. Unbilled results use canonical invoice eligibility and legacy finalized-invoice evidence; entry summaries preserve `durationMs` as actual elapsed time and add `billableDurationMs` for invoice calculations.

## Local bridge process

Configuration may be supplied by CLI flags or the documented `TASKTIME_AGENT_*` environment variables in `.env.example`. Defaults must remain loopback-safe. Status-file discovery may expose endpoint and pairing launch information but never app-session tokens.

Stable managed identities include platform-specific `agent-id` and `agent-label`; the dynamic port is not identity. Pairing codes are single-use/short-lived, and app sessions expire or end on revocation/process exit.

## Published artifacts

- npm: `@tasktimepro/agent-bridge`
- MCP Registry: `pro.tasktime/agent-bridge`
- binary: `tasktime-agent-bridge`
- discovery: `/.well-known/tasktime-agent.json`
- tool catalog: `/agents/mcp-tools.json`
- generated skill: `/agents/skill.md`
- OpenClaw and Claude bundles under `integrations/`

The discovery manifest is additive and advertises explicit core-use facts under
`app`: no TaskTime account is required for core use, core use is free, the PWA
is offline-capable, the source is public, work records use browser-local
storage, and limited aggregate usage metrics are enabled on the production
origin. Its `clawHub` object identifies the canonical `tasktimepro` owner,
`tasktime-agent` slug, owner-qualified reference, public source repository, and
source path. Consumers must tolerate additional manifest fields.

Release coordination is specified in `docs/agent-release-runbook.md`.
