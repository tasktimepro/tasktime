# Data Schemas

All persisted entities use string identifiers. Timestamps are epoch milliseconds unless a field explicitly uses an ISO calendar date (`YYYY-MM-DD`) or ISO string. Optional historical fields may be absent; nullable fields may explicitly contain `null`. Runtime schemas generally preserve unknown fields for compatibility while validating known invariants.

## Document and collection placement

| Document | Collections |
|---|---|
| `core` | Projects, active tasks, clients, business information/assets, current invoices, templates, payment methods, expense categories, tax periods, active expenses/recurrences, planner attachments, goals, preferences, timers, and other always-loaded collections |
| `entries-active` | Recent `timeEntries` |
| `entries-{year}` | Historical `timeEntries` for a year |
| `tasks-archived` | Archived `tasks` |
| `expenses-archived` | Archived `expenses` |
| `invoices-archived` | Archived/older `invoices` |

Movement between documents must preserve entity identifiers and references.

Tasks, time entries, invoices, and expenses may carry additive
`_archiveTransition` metadata (`operationId`, `targetDoc`, `changedAt`). New
cross-document moves write their destination first and retain this identity so
an interrupted move or stale cloud replay can be completed deterministically.
When both source and destination copies exist, loaded-document and post-sync
reconciliation keeps one canonical copy; legacy task duplicates prefer the
archive destination, while one-way archives retain the freshest valid record
and re-evaluate whether it still meets the archive predicate.

Validated collection keys are: `projects`, `tasks`, `timeEntries`, `clients`, `businessInfos`, `businessBrandAssets`, `invoices`, `invoiceTemplates`, `emailTemplates`, `paymentMethods`, `expenseCategories`, `taxReturnPeriods`, `expenses`, `expenseRecurrences`, `plannerAttachments`, `dailyGoals`, `preferences`, and `timers`.

## Core work entities

### Project

Required: `id`, `title`.

Optional contract includes timestamps, description, versioned notes, `invoiceIds[]`, hourly/flat pricing, preferred client, personal/archive state, color, billing increment, task view/sort, quote/active status mode, deadline/resolution, and budget.

### ProjectNotes

Required: `version: 1`, `type: tiptap-json`, JSON `content`, `updatedAt`. Optional `plainTextPreview`. Rich-text nodes allow typed attributes/content/marks/text with JSON-safe values.

### Client

Required: `id`, `title`. Optional legal/contact/address/tax/custom fields, hourly/flat/currency defaults, tax disabling, archive state, and color. `hourlyRate` is a supported legacy alias of `defaultHourlyRate`.

### Task

Required: `id`, `title`. Optional `projectId`, `parentTaskId`, notes, completion/archive/billable/order/activity/billing dates, start date, estimates, prompt behavior, quote billing snapshot, and recurrence state.

`lastBilledAt` is retained as legacy task-level compatibility metadata; it is not sufficient by itself to claim or exclude a time entry in current billing flows.

Recurrence types are weekly, monthly, or yearly with their corresponding day/date settings. Subtasks must not use recurrence even though tolerant persisted validation may accept historical data pending normalization.

### TimeEntry

Required: `id`, `taskId`, finite `start`, finite `end`; `end >= start`. Optional timestamps, note/source, billed rate/date/invoice/duration/increment snapshots, and stopped-timer instance/operation reconciliation identity.

For billing periods, dashboards, reports, and exports, a time entry is assigned
wholly to the local calendar date of its `start` timestamp. Entries crossing
midnight are not clipped or divided between periods; billing continues to
consume the exact persisted entry identity.

### MultiTimerState

Required: `projectId`, `taskId`, finite `startTime`. Optional timer instance identity, paused state, non-negative paused elapsed time, note, and activity time. The collection is keyed so one project has at most one timer state.

## Billing entities

### Invoice

Required: `id`, nullable `projectId`, `clientId`, `invoiceNumber`, calendar `date`, status (`draft|sent|paid|overdue`), `items[]`, finite `subtotal`, finite `total`.

Optional fields include multiple project IDs/breakdowns, expense breakdowns, business info, timestamps, due date, tax/rate, notes, payment method, billing-period metadata, currency, payment/sent metadata, and branding/billing-state snapshots.

Each invoice item requires description, quantity, rate, and amount and may reference project/task/expense, original currency/exchange rate, line type, labels, and pricing mode (`hourly|flat|mixed`).

`billingSelectionSnapshot` is additive, immutable versioned evidence captured before finalization. Version 1 records the invoice currency; exact selected entry IDs, task IDs, intervals, actual/billable durations, and billed rates; exact task pricing mode, quantity, rate, amount, and quoted allocation; and exact expense source/invoice amounts, currencies, and exchange rate. Finalization of a snapshot-backed draft must reject missing, changed, or already-consumed source records and must not discover newly arrived work during commit.

Billing snapshots are immutable evidence used for reporting/undo. Historical invoices may lack newer snapshots and require compatible fallback behavior; their absence must not make old records unreadable.

Supported finalized legacy invoices may retain composer `tasks[]` records with per-task `originalTimeMs` or `originalHours` and merged-subtask identity. These fields are read-only compatibility evidence for older markerless source entries: they affect eligibility only when the invoice billing period and stored source duration account for the complete candidate set. Ambiguous matches and entries created after that invoice remain unbilled candidates. No inferred marker is persisted.

### Invoice billing operation journal

The core Yjs document contains an internal `invoiceBillingOperations` map for cross-document finalization and undo recovery. Version 1 records have a stable operation ID, invoice ID, operation kind (`finalize|undo`), created/updated timestamps, prepared/complete state, last completed phase, and the deterministic desired-state application plan. Finalization records also retain the desired invoice; undo records retain the removed invoice as reversal evidence.

The journal is written before product data is mutated, is replayed at startup for pending operations, and is replayed after sync for both pending and completed operations so late-arriving document updates converge. Replay must be conditional and idempotent: it must not replace a newer invoice payment state, a newer task cutoff, a different invoice's entry/expense/quote claim, a later project invoice reference, or an advanced template sequence. Journal records are sync metadata in the core document and are intentionally omitted from portable backups; export must finish any pending operation before creating a backup snapshot.

### Templates and payment methods

- `InvoiceTemplate`: required `id`, `name`; optional numbering, notes/tax/due defaults, default flag, layout/branding/display settings.
- `EmailTemplate`: required `id`, `name`, type (`invoice|quote`), subject, send/reminder bodies, attachment title; optional sender/reply/default/timestamps.
- `PaymentMethod`: required `id`, `title`, `custom[]`; optional banking/PayPal/instruction/default/legacy name fields.
- `BusinessInfo`: required `id` plus compatible name/title and businessName/name combinations; optional contact/tax/custom/default/branding fields.
- `BusinessBrandAsset`: required ownership, image kind/data URL/MIME/dimensions/byte size/hash/timestamps with supported SVG/PNG/JPEG/WebP types.

## Expense and tax entities

### Expense

Required: `id`, `title`, calendar `date`, `currency`, finite `amount`, payment status, personal/billable flags, billing status, recurrence flag, and tax-exempt flag.

Optional fields cover notes/supplier/receipt, payment details/mode/currency snapshot, client/project/business/category, invoice/billed state, recurrence, fixed/variable amount type, tax details/claim period, preview state, and timestamps.

### ExpenseRecurrence

Required: identity/title/currency/amount, amount type, repeat (`monthly|yearly`), start date, personal/billable/tax-exempt flags, and active state. Optional schedule end/day/type, relationships, payment/tax fields, last generated date, and timestamps.

### ExpenseCategory and TaxReturnPeriod

- Category: required `id`, `name`, `isDefault`, `archived`; optional group/timestamps.
- Tax period: required `id`, `title`, type (`vat|income-tax|sales-tax|other`), start/end dates, status (`draft|filed|paid`); optional business, event timestamps, notes, and timestamps.

## Planning and preferences

- `PlannerAttachment`: required identity, referenced entity type (`client|project|task`), reference ID, mode (`static|date|weekday`), order, and creation timestamp; optional date/weekday/estimate according to mode.
- `DailyGoal`: required identity, weekday `0..6`, creation time; optional hour/earnings targets and update time.
- `Preferences`: optional currency/date/time/theme/default view/week start/display/sort/billable/sync/goal/notification/backup settings. Missing preferences use application defaults.

## Relationship invariants

- Task `projectId` references a project; `parentTaskId` references another task in the same logical project hierarchy.
- TimeEntry `taskId` references a task, including supported archived/historical resolution paths.
- Project `invoiceIds[]` references separate invoice entities.
- Invoice/expense/task/client/project/template references remain explicit IDs, not embedded mutable source records, except immutable billing/branding snapshots.
- Planner attachments reference entities and do not duplicate ownership.
- Deletion and import must validate relationships; billing/claimed records receive stricter protection than unbilled/unclaimed records.

The executable counterparts are `src/stores/yjs/types.ts` and `src/stores/yjs/validation.ts`. Any discrepancy is contract drift requiring reconciliation, not permission to silently prefer one source.
