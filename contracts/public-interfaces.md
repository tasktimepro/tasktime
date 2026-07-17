# Public Interfaces

These interfaces are durable boundaries. Implementation types, validation, generated catalogs, and tests must remain aligned with this contract.

## Browser application routes

The stable route surface is defined in `spec/routes.md`. Navigation uses History API state through `useUrlState`; route changes must preserve reload and back/forward behavior and must not capture public Astro routes.

## React data APIs

Components obtain product state and mutations through entity hooks under `src/hooks/`, including projects, clients, tasks, time entries, timers, invoices, expenses/recurrences/categories, tax periods, business information/assets, payment/invoice/email templates, preferences, notes, planner attachments, goals, and sync/auth behavior.

Callers must not create a second persistence layer. Hook return shapes may evolve additively, but established mutation semantics and persisted effects are durable.

`useTimers` is the browser timer-lifecycle boundary, including stop recovery and timer-created entry snapshots; `stopTimer` resolves asynchronously after complete-history validation/recovery. `useTimeEntries` keeps generic internal CRUD for controlled billing/deletion applications and exposes asynchronous protected manual-entry mutations for user-facing create/edit/delete flows so historical documents and archived task relationships are loaded before mutation. Project, client, and task hooks validate relationship-bearing writes through the same domain contracts used by agent commands; persisted entity IDs are immutable and create operations reject an existing ID before writing.

`useExpenses` retains synchronous raw create/update methods for controlled internal applications, while user-facing paid or payment-sensitive mutations use `createExpenseWithPaymentSnapshot` and `updateExpenseWithPaymentSnapshot`. Those asynchronous methods prepare required cross-currency evidence before committing. `deleteExpense` rejects billed/invoice-linked and tax-claimed expenses on every UI call path.

`useInvoices.cancelInvoice` and the agent `cancel_invoice` command are adapters over one shared cancellation application. The operation accepts `invoiceId`, a trimmed 1–500 character `reason`, a stable `operationId`, and an optional finite `canceledAt`; adapters additionally require exact invoice-number confirmation and agent approval. It returns the retained canceled invoice plus stable counts for released time entries, deleted adjustment entries, released expenses, released quoted tasks, restored task cutoffs, and retained project links, with `retainedInvoiceNumber: true` and retry state through `alreadyApplied`. The operation rejects missing, draft, paid, and conflicting already-canceled invoices without partial product mutation and replays the same persisted operation idempotently.

`useInvoices.markAsUnpaid` and the agent `mark_invoice_unpaid` command are payment-correction boundaries, not refund operations. They accept only an invoice whose current persisted status is `paid`, clear its payment evidence, and preserve every billing-source claim. Missing, non-paid, and canceled invoices fail without mutation; callers cannot use this transition to reopen or alter a sent, overdue, draft, or canceled invoice.

## Persisted Yjs boundary

- Managed document names: `core`, `entries-active`, `entries-{year}`, `tasks-archived`, `expenses-archived`, `invoices-archived`.
- Collection/entity contracts: `contracts/data-schemas.md`.
- Unknown additional entity fields are tolerated where validation uses passthrough, enabling forward/legacy compatibility.
- Cross-document operations must remain safe under replay, partial completion, reconnect, and concurrent-device updates.

## Backup JSON

Current export version: `1.5`.

Supported import versions: `1.0`, `1.1`, `1.3`, `1.4`, `1.5`.

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
- `/auth/access-token`
- `/drive`
- `/metrics/batch`
- `/push/vapid-public-key`, `/push/subscription`, `/push/schedules`, `/push/test`

The dev/build pipeline validates the configured Worker URL and adds only its
origin to the HTML `connect-src` policy. HTTPS is required except for explicit
loopback development URLs; malformed, credential-bearing, or non-loopback HTTP
values fail closed instead of weakening the browser policy. A staging-configured
build therefore does not require the production app to permanently trust the
staging Worker hostname.

The Worker owns OAuth code exchange, encrypted refresh-token persistence, session validation, token issuance, revocation, and the retained Drive compatibility proxy. The browser owns product data semantics. A successful status response may additively select either `proxy` or `direct` transport for the next connection; absent, malformed, disabled, or unsupported policy selects the proxy. Direct connections request a short-lived Google access token from `POST /auth/access-token`, retain it only in active-tab memory, and send routine Drive file requests directly to Google Drive. The Worker must never return a refresh token and may cache its short-lived Google access token only in encrypted private session storage. Errors exposed to the browser must be sanitized; private deployment/KV/D1 details are not part of this public contract.

`POST /auth/access-token` accepts the existing opaque `X-Session-Id` and no credential in its URL. It accepts only an optional boolean `forceRefresh` body field, rechecks the current direct-transport policy before issuing, and returns a short-lived bearer token, its absolute expiry, Worker time, and known grant scope. Every success and failure response is `no-store`. A policy change takes effect on the next connection or sync pass; ambiguous direct mutations must not be replayed through the proxy.

Google-grant revocation and local disconnect are separate auth behaviors. The browser clears its stored Worker session after confirmed revocation or an already-invalid grant, but preserves it and surfaces an error when revocation fails transiently so the operation can be retried truthfully.

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
- invoice/quote preview, drafts, finalization, payments, cancellation, undo, PDF, and email
- business information/assets, payment methods, invoice/email templates, preferences
- reports, accountant/export outputs, dashboards, and unbilled queries
- Drive sync/backup/import/account data operations
- application navigation

The authoritative command-name/metadata catalog is generated from `src/agent/commands/registry.ts`. A command may additionally require explicit TaskTime approval and idempotency/confirmation data. Changes require synchronized tool schemas, bridge package, bundles, public docs, and tests.

`stop_timer` accepts an optional `idempotencyKey` and also converges concurrent stops through deterministic timer-instance entry identity. Manual time-entry commands validate complete local history and source/target billing rules before mutation. Generic `update_task` requests are normalized through task-state invariants; recurring completion still requires the occurrence-aware `complete_task` command. Create commands return `CONFLICT` for an existing persisted ID and must not replace the prior record.

`find_unbilled_time`, dashboard/project unbilled summaries, and recent-entry billing state load complete local task, time-entry, and invoice history. Unbilled results use canonical invoice eligibility and legacy finalized-invoice evidence; entry summaries preserve `durationMs` as actual elapsed time and add `billableDurationMs` for invoice calculations.

`cancel_invoice` is billing-scoped and approval-required. Its closed input contains `invoiceId`, `reason`, `confirmCancel: true`, exact `confirmationText`, optional finite `canceledAt`, and optional retry-safe `idempotencyKey`. Missing invoices return `NOT_FOUND`; invalid reason/confirmation returns `INVALID_INPUT`; draft, paid, terminal, or conflicting operation state returns `CONFLICT`; unavailable complete history returns a sanitized retry-safe error. Responses expose documented invoice summaries and release counts, never raw Yjs maps or journal records. Invoice/report status filters add `canceled` without renaming or changing existing defaults.

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
