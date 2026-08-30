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
- **WORK-6:** Free permits one active client and Trial/Pro permit unlimited active
  clients. Active means `client.archived !== true`, including legacy records
  without the field. Create, explicit unarchive, and generic
  `archived:false` transitions use one revalidating policy. The limit refuses
  only a net increase; existing, downgraded, imported, restored, synced, or
  concurrently merged over-limit clients and dependent data remain visible,
  editable, usable, archivable, deletable, exportable, and recoverable. Import,
  restore, and sync never fail, discard, or auto-archive records because of the
  count.

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
- **BILL-8:** Canceling a finalized unpaid invoice must retain its immutable invoice record, number, totals, snapshots, and project links while terminally marking it canceled and releasing only source records still claimed by that invoice.
- **BILL-9:** Cancellation requires a non-empty reason and exact invoice-number confirmation, is idempotent and replay-safe, never rewinds numbering, and rejects drafts, paid invoices, repeated cancellation under a different operation, and all uncancel attempts.
- **BILL-10:** Canceled invoices are non-payable, non-emailable, immutable outside explicit deletion cascades, and visibly canceled in every retained invoice document; credit notes, refunds, partial cancellation, filed-tax adjustment, and cancellation notices are separate future workflows.

## Reports and export/import

- **REPORT-1:** Report totals must derive from the same canonical time, expense, invoice, payment, tax, date, client, project, and currency semantics used elsewhere.
- **REPORT-2:** Filters and date ranges must apply consistently to on-screen summaries and exported CSV/PDF/accountant packs.
- **REPORT-3:** Canceled invoices remain available as audit rows with original face value and cancellation metadata but contribute zero to revenue, payment, output-tax, profit, outstanding, overdue, aging, and client-statement totals.
- **REPORT-4:** Free Reports Overview covers the current local calendar month and
  exposes exactly **Received**, **Expenses**, and **Tracked time**. Received uses
  the canonical effective paid timestamp and payment-currency fallback; Expenses
  uses gross stored amounts by expense date; Tracked time uses actual completed-
  entry duration by entry start. Currency totals remain grouped without a live
  conversion request. It exposes no filters, history, rows, exports, current-
  client, net/profit, tax, outstanding, or uninvoiced aggregate. It reads only
  always-loaded local sources and renders without waiting for cloud connection,
  catalog, JWKS, or billing status.
- **REPORT-5:** `/reports` and every advanced tab, including To Invoice, remain
  visible, directly addressable, and keyboard-selectable. Free selecting an
  advanced tab sees a section-specific static Pro preview and non-color-only Pro
  badge. Entitlement branches before mounting an advanced module or loading
  protected history, report calculations, rows, exchange rates, or export code.
  Missing, unknown, malformed, or case-mismatched report sections canonicalize
  to Overview.
- **BACKUP-1:** Export a portable backup containing supported account data without secret credentials.
- **BACKUP-2:** Preview imports before mutation and restore valid supported backups without breaking relationships.
- **BACKUP-3:** Keep public compatibility fixtures and regression tests for representative older backup shapes.

## Subscription entitlements and hosted services (planned; not yet enabled)

- **ENTL-1:** Keep core local use account-free and Free. Initial Pro gates are
  limited to net-increasing active-client transitions beyond one, advanced
  Reports/ranges/outputs and equivalent advanced report-agent scopes, and
  TaskTime-hosted sending. `/reports`, its current-month Overview, and visible
  advanced previews remain Free.
- **ENTL-2:** Entitlement attaches to a semantic action, not a shared utility.
  Dashboard, client/project/unbilled calculations, invoices/PDFs, Expenses/tax
  bookkeeping, email preparation/manual delivery, sync/backups, portability, Web
  Push, and core agents remain Free even where they reuse report/email code. A
  compact Expenses surface must preserve tax-period list/create/update/file/pay
  and expense claim/unclaim browser operations without report aggregates.
- **ENTL-3:** Every hosted principal may explicitly start at most one server-timed
  30 x 24-hour Pro trial without a card, Stripe trial/subscription, automatic
  charge, renewal, reset, or navigation/OAuth side effect. Early paid access
  takes precedence without pausing the immutable trial; if that higher-priority
  source ends first, the trial remains a fallback only until its original end.
- **ENTL-4:** Verify a short-lived ES256 assertion against the exact active
  provider lifecycle binding and trusted time before advanced Reports access or
  an unlimited-client transition. Free Overview needs no Pro assertion. An
  assertion never authorizes Worker-cost services and never enters Yjs, provider
  data, backups, exports, or origin migration.
- **ENTL-5:** Canonical Stripe state, bounded reconciliation freshness, current
  period/grace, and server configuration govern paid access. Redirects, cached
  display state, stale D1 rows, and client-supplied identities never grant it.
- **ENTL-6:** The Worker publishes a sanitized versioned catalog. Clients and the
  homepage do not hardcode prices, tax labels, allowances, legal versions, or
  Stripe IDs; a changed catalog requires fresh purchase confirmation.
- **ENTL-7:** Hosted email uses a UTC calendar-month allowance and atomic,
  idempotent primary/forward reservations. Provider-accepted parts consume;
  proven pre-acceptance failure releases; ambiguous outcomes remain reserved and
  are not automatically resent.
- **ENTL-8:** Provider transfer, trial, Checkout, webhook reconciliation, grants,
  deletion, and hosted-email reservations serialize or compare durable versions
  so retries/concurrency cannot duplicate a trial, customer, subscription,
  allowance, ownership, or send.
- **ENTL-9:** Trial/subscription expiry or rollback removes only advanced
  Reports, hosted Send, and future net-increasing active-client transitions. It
  never deletes, hides, rewrites, disconnects, or makes existing product/
  accounting data impossible to maintain or export.
- **ENTL-10:** Trial, Checkout, and provider flows return to the originating safe
  route/draft but never auto-send email, auto-export, replay an agent command, or
  perform another consequential action without fresh confirmation.
- **ENTL-11:** A versioned successful canonical Free status includes a signed
  Free assertion. Identity conflict, canonical unavailability, unsupported
  response version, and stale lifecycle responses cannot authorize Pro and must
  render repair/retry/update state rather than Free or a repurchase prompt.
- **ENTL-12:** An acceptance-unknown hosted email has a privacy-minimized durable
  attempt and a caller-owned D1-only status operation. Status never contacts the
  provider, resends, changes allowance, or returns raw provider IDs; accepted
  local sent metadata is applied idempotently only after current-record/lifecycle
  revalidation.
- **ENTL-13:** Cross-database provider transfer uses a durable idempotent journal,
  EMAIL_DB prepare/apply record, direct aliases, and a hosted-action fence until
  both stores agree. Crashes/retries cannot expose a partial license/quota move,
  reset allowance/trial, or activate the target early.
- **ENTL-14:** Launch packaging has exactly Free and Pro. Trial is an entitlement
  source and Founding/Standard are Pro offers, not additional plans. The founding offer is
  annual EUR with `unitAmountMinor:3900` (`EUR 39.00`) for the first 1,000
  canonical hosted principals whose initial subscription payment succeeds.
  The standard offer is annual EUR with `unitAmountMinor:5900` (`EUR 59.00`).
  Checkout capacity is reserved atomically and never oversold; committed paid
  allocations are never recycled. Temporary reservation saturation is retryable
  and does not activate standard pricing. Once 1,000 allocations are committed,
  new purchases use standard without reading or mutating founding slots.
  The same continuous/recoverable subscription retains its founding base price;
  cancellation defaults to period end, reversal before that date preserves it,
  and terminal cancellation followed by a new purchase uses standard. A
  continuous/recoverable standard subscription likewise retains its recognized
  `EUR 59.00` Price. A stale
  founding intent must show the standard order summary and require fresh
  confirmation before Stripe creation; it is never silently repriced. No exact
  remaining count is exposed.

## Sync and offline behavior

- **SYNC-1:** Keep core product behavior available offline and make connectivity state visible.
- **SYNC-2:** Preserve the manual, backup, and sync trigger matrix documented in `AGENTS.md`, including the 1.5-second quiet-period auto-sync for project notes in automatic modes, manual mode's explicit-only behavior, and Sync mode's visible-only five-minute manifest checks.
- **SYNC-3:** Keep normal Worker/provider requests proportional to actual work. A clean foreground event inside the cooldown makes zero requests. After the cooldown, a clean unchanged check makes at most one manifest-metadata request, records that successful check for the next cooldown, and performs no document download, upload, manifest save, backup listing, or full provider-namespace listing. Heavier recovery requests require a correctness justification and request-count regression coverage.
- **SYNC-4:** Serialize cross-tab synchronization, retry genuine pending local work with bounded backoff after active-sync or Web Lock contention, do not queue a second page-exit pass while one is active, persist dirty identity per document, and recover only affected disconnected documents on reconnect. Pull/consistency retries remain distinct from unsynced local data.
- **SYNC-5:** Never auto-sync destructive resets or conflict decisions that can undo a valid change from another device.
- **SYNC-6:** Keep provider-local disconnect and provider-grant revocation as distinct internal auth operations, but expose only two consistent connected-provider choices: Disconnect, which syncs then detaches this browser while retaining cloud data and authorization, and Wipe data & disconnect, which verifies deletion of all TaskTime sync files and backups before confirmed revocation and disconnect. A transient revocation or auth-status failure preserves the retryable Worker/browser session and must not be reported as successful revocation.
- **SYNC-7:** Google Drive and Dropbox sync use direct provider requests. Each may keep only a short-lived access token in active-tab memory, sends normal sync file requests directly to the selected provider, and never routes a routine provider file body through the Worker.
- **SYNC-8:** One cloud provider is active per browser profile. A verified transfer may copy the complete workspace to the other provider, read it back, link the opaque hosted identity, activate the target, and detach the former local session without deleting source files or backups. A later connection to the retained source stops at its verified move marker and primarily offers the recorded destination. Explicitly reusing that source deletes and verifies all TaskTime backups and sync files there, removes the marker last, leaves the destination unchanged, and seeds the complete local workspace without pulling or merging the retained source.

## Agent access

- **AGENT-1:** Expose business actions through a loopback-only local MCP bridge; never expose raw Yjs/IndexedDB access.
- **AGENT-2:** Require explicit short-lived pairing, session management, scoped permissions, approvals for sensitive actions, revocation, and rate limiting.
- **AGENT-3:** Keep app-session bearer tokens in browser/bridge memory or the current tab's bounded `sessionStorage` resume record only. Exclude bearer tokens, pairing codes, reconnect private keys, and approval credentials from logs, status files, synced/product storage, backups, exports, docs, diagnostics, and recovery responses.
- **AGENT-4:** Every new or changed user-facing business action receives a UI/agent parity review. Supported actions use the same domain/application operation and keep behavior, validation, errors, permissions, approvals, tool schemas, generated docs, bundles, and published package metadata aligned; intentional exclusions are documented and not advertised as parity.
- **AGENT-5:** Support the long-running task/time flow across agent turns and ordinary browser lifecycle events: select/create task, start timer, allow work to continue, refresh or close/reopen TaskTime in the same browser profile, stop the same timer, and verify the created entry.
- **AGENT-6:** A managed OpenClaw installation uses one native plugin service owned by the supervised Gateway. Ordinary agent turns reuse that bridge; generic MCP and Claude hosts retain the existing stdio bridge contract.
- **AGENT-7:** Same-browser reopen uses proof of possession rather than a persisted app-session bearer token. Explicit pairing registers a non-exportable, origin-local P-256 signing key; the live bridge keeps only its in-memory public-key authorization and issues a fresh scoped session after a single-use, short-lived, instance/origin-bound challenge. Stable agent IDs and discovery metadata are never authentication.
- **AGENT-8:** Browser reconnect authorization ends on explicit disconnect/forget, revocation, disabling agent access, expiry, definitive proof rejection, local credential deletion, or bridge/Gateway restart. Another browser profile, device, or private session requires explicit pairing.

## UX, accessibility, and operations

- **UX-1:** Support desktop and mobile navigation for all primary product areas.
- **UX-2:** Provide explicit loading, empty, error, success, disabled, offline, and destructive states where relevant.
- **UX-3:** Use semantic, keyboard-operable, labeled controls with visible focus and non-color cues.
- **OPS-1:** Run development and release commands through Docker-backed Make targets.
- **OPS-2:** Keep public/private repository boundaries and environment documentation accurate.
- **OPS-3:** Run lint, repository-wide TypeScript checking, coverage, browser smoke, PWA smoke, and build checks as the broad release gate.
- **OPS-4:** Review the persisted-data and cross-surface change impact matrix before completion; no consumer may be silently omitted.
