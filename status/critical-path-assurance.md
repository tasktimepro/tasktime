# Critical-Path Assurance Remediation

This is the execution checklist for the production-safety findings discovered during the July 2026 deep validation. It complements `spec/roadmap.md`; it does not replace product requirements, contracts, or the broader `TODO.md` backlog.

## Current state

- [x] Complete the initial source, contract, unit, browser, PWA, and live-agent audit.
- [x] Confirm the current broad baseline: lint, build, 1,746 tests, coverage, 34 browser smoke tests, 2 PWA smoke tests, and the live agent release flow.
- [x] Complete remediation slices A-G below.
- [x] Run the full release gate and reconcile specifications, contracts, status, and generated agent artifacts.
- [x] Clear the repository-wide TypeScript baseline and make type checking a required release gate.

Do not mark this assurance phase complete while a Critical or High finding remains unresolved or while a required product decision remains open in `spec/ambiguities.md`.

## Slice A — Cloud sync and local persistence safety

- [x] Prevent an initial offline Backup-mode connection from uploading full local state before existing Drive state is reconciled.
- [x] Preserve durable dirty-document evidence across authorization failure, disconnect, reload, and reconnect.
- [x] Make “Sync Now” perform the documented full pull/push reconciliation in every mode.
- [x] Treat failed/corrupt remote base or delta application as an incomplete sync, not a successful idle state.
- [x] Add cross-device manifest revision/merge protection for concurrent writers.
- [x] Make cross-document archival replay-safe, deduplicated, and recoverable after partial completion.
- [x] Filter malformed time entries at calculation/export read boundaries while preserving raw CRDT convergence; extend the same policy to other affected collections as their slices are addressed.
- [x] Add regression coverage for offline-first Backup reconnect, auth expiry with pending work, simultaneous writers, partial archival, malformed remote entries, and pull failure.

## Slice B — Backup, restore, deletion, and compatibility

- [x] Fully normalize and schema-validate an entire backup before destructive mutation; broader cross-collection relationship coverage remains below.
- [x] Restore through staging/commit with a recoverable pre-restore snapshot or equivalent rollback.
- [x] Fail visibly when IndexedDB deletion is blocked or errors instead of reporting success.
- [x] Add proactive cross-tab close coordination and post-delete verification.
- [x] Ensure automatic/Drive backups refresh every local and remote lazy document or clearly fail as incomplete; agent backup completeness remains tied to its explicit cloud-refresh option.
- [x] Stop claiming account/backup deletion succeeded when any Drive deletion failed; verify before revoking access.
- [x] Cover advertised backup versions 1.0, 1.1, 1.3, 1.4, and 1.5 plus legacy persisted invoice shapes.
- [x] Provide a safe historical-document discovery fallback where `indexedDB.databases()` is unavailable.
- [x] Add rejected-import-no-mutation, blocked-delete, relationship, legacy, and complete-backup tests; in-process and crash-recovery rollback are covered.

## Slice C — Invoice candidate, calculation, and billing-state exactness

- [x] Load the same complete active/historical/archived candidate set for UI preview, agent preview, and finalization.
- [x] Persist immutable selected task, time-entry, expense, duration, rate, currency, and flat-amount allocations on the draft/finalization snapshot.
- [x] Finalize only the exact immutable selection shown and approved; never discover additional hidden work during commit.
- [x] Decide and implement edited-down hours semantics without silently consuming unexplained time.
- [x] Make late-synced unbilled entries eligible based on explicit billing allocation rather than only `lastBilledAt` cutoffs.
- [x] Reconcile legacy markerless entries only from exact finalized-invoice evidence, with shared UI/agent eligibility and a privacy-safe backup regression fixture.
- [x] Preserve or explicitly release archived-task work that is still unbilled.
- [x] Recompute or reject inconsistent item quantity/rate/amount/subtotal/tax/total input using deterministic minor-unit rounding.
- [x] Reconcile multi-project rounding remainders so allocated totals equal the invoice total exactly.
- [x] Ensure agent flat-rate finalization claims the exact quoted task amount once.

## Slice D — Invoice lifecycle, currency, rendering, and undo

- [x] Require finalized billing state before an invoice can be sent or marked paid; keep quote behavior non-mutating.
- [x] Decide and enforce the supported policy for editing sent/paid invoices.
- [x] Use the Yjs preference currency consistently; remove legacy localStorage currency reads from finance paths.
- [x] Reject cross-currency payment snapshots when required conversion rates are unavailable or invalid.
- [x] Render canonical `Invoice.items` in the shared PDF/email/accountant-pack path while retaining legacy composer compatibility; remaining UI display parity is covered by existing canonical list views.
- [x] Normalize supported legacy invoices at persisted/remote read boundaries instead of silently hiding them.
- [x] Make finalization and undo durable, replay-safe operations with persisted operation identity/state and boot/sync reconciliation.
- [x] Add failure-injection tests between every cross-document finalization/undo phase.

## Slice E — Reports and export consistency

- [x] Load required archived invoices, expenses, tasks, and historical entries before calculating or exporting UI and agent reports.
- [x] Gate Reports readiness and export controls on every required document load.
- [x] Decide one time-entry date-boundary allocation rule and share it across UI, billing, reports, and agents.
- [x] Use local calendar-date semantics consistently for payment/report filtering unless an explicit stored timezone contract replaces it.
- [x] Remove silent agent export truncation by returning explicit total/exported/truncated metadata.
- [x] Resolve billed invoice references independently of current report filters.
- [x] Neutralize spreadsheet formulas in CSV fields.
- [x] Sanitize and uniquify accountant-pack invoice filenames so no report entry overwrites another.
- [x] Add UI/agent parity fixtures for archives, midnight/month boundaries, currencies, row limits, and exported totals.

## Slice F — Agent replay, validation, and trust hardening

- [x] Make timer stop idempotent by durable timer-instance/operation identity across partial entry-create/timer-delete failure.
- [x] Enforce advertised MCP input schemas at the bridge boundary.
- [x] Keep billing/email/export scopes and approvals aligned with the actual downstream mutations.
- [x] Show requested scopes before pairing and bind persistent grants to a stronger stable agent identity.
- [x] Regenerate and validate command catalogs, bridge package, OpenClaw/Claude bundles, and public docs after command/schema changes.

## Slice G — Shared UI/agent operation follow-up

- [x] Remove automatic recurring-task skip cleanup writes; derive current-occurrence skip state without overwriting stale or concurrently synced skip evidence.
- [x] Reject caller-supplied duplicate entity identities before mutation in shared UI collections and agent creates, including loaded archive documents.
- [x] Enforce one billed/tax-claimed expense deletion guard in UI hooks, modals, and agent commands.
- [x] Make agent dashboard, project, unbilled, and recent-entry queries load complete lazy data and use canonical billing evidence and billable duration.
- [x] Prepare required paid cross-currency expense snapshots before create/update/recurring persistence and advance recurrence cursors only after successful generation.
- [x] Add regressions for duplicate identity preservation, protected expense deletion, historical/legacy billing query parity, FX failure atomicity, and recurring retry behavior.

## Slice H — Repository-wide type-safety baseline

- [x] Clear all 87 repository-wide `tsc --noEmit` diagnostics without narrowing the files included by the compiler.
- [x] Replace stale ambient dependency declarations with the installed package types while preserving the project-specific Yjs compatibility declarations.
- [x] Align app, domain, report, invoice, sync, and agent types with supported persisted legacy shapes and current runtime contracts.
- [x] Preserve project-note local-only transaction origins through the centralized project update hook and add a regression for the forwarding contract.
- [x] Add `make typecheck` and require it in both the Makefile and npm release gates.

## Required validation

- [x] Focused red/green tests for every completed checklist item.
- [x] `make test-run`
- [x] `make test-coverage`
- [x] `make lint`
- [x] `make typecheck`
- [x] `make test-e2e-smoke`
- [x] `make test-e2e-pwa-smoke`
- [x] `make build`
- [x] `make npm CMD="run release:agent"`
- [x] Final pre-ship review against requirements, contracts, historical fixtures, and this checklist.

## Work log

### 2026-07-10 — Remediation started

- Added deferred first-connect reconciliation so Backup mode pulls existing Drive state before any offline-queued upload.
- Persisted provider pending document identities before disconnect/auth-expiry clears in-memory sync queues.
- Routed UI “Sync Now” through the store’s documented full-state verification behavior.
- Added full backup schema validation before restore mutation and repeated it for direct store callers.
- Added automatic rollback to the pre-restore workspace, including active timers, when applying a validated replacement fails; durable crash-safe staging remains open.
- Changed blocked/failed IndexedDB deletion from silent success to a recoverable error.
- Made Drive backup deletion fail closed and verify that no backup remains before account revocation/disconnect can continue.
- Made Drive backups refresh lazy archived and historical documents instead of silently snapshotting only loaded state.
- Rejected failed cross-currency payment conversions instead of recording an invented 1:1 snapshot.
- Filtered malformed time entries from calculations and backup/report-facing reads.
- Gated Reports on every lazy data source and gave agent reports the same complete archive/history loading behavior.
- Added CSV formula neutralization, explicit agent truncation metadata, filter-independent billed invoice labels, and collision-safe accountant-pack filenames.
- Rendered canonical invoice items through the shared PDF/email path, including agent-created invoices.
- Made corrupt, missing, empty, or unreadable manifest-referenced Drive states/deltas fail the sync instead of being treated as successfully applied or pruned.
- Added immutable versioned billing-selection snapshots and made snapshot-backed finalization consume exactly the approved entries, tasks, expenses, rates, durations, conversions, and quoted amounts.
- Included complete historical and archived billing candidates in both UI and agent previews; late-synced unbilled entries remain eligible for later invoices.
- Rejected reduced invoice hours until source entries are explicitly split/edited, while retaining visible positive adjustment entries for increases.
- Reconciled canonical invoice arithmetic and blocked draft send/payment plus normal sent/paid editing paths.
- Made agent timer stop recover by durable timer-instance and caller operation identity after partial cross-document completion or lost in-memory session state.
- Added additive Drive manifest revisions/write identity, pre-save remote/file merging, base-file modification evidence, and compaction tombstones for simultaneous writers.
- Added durable archive/unarchive operation identity and load/post-sync reconciliation for tasks, historical entries, old invoices, and expenses, including interrupted-move and stale-replay regressions.
- Routed UI and agent invoice finalization/undo through one persisted core operation journal, with conditional idempotent startup/post-sync replay and failure-injection coverage at every entry, expense, task, core-link, invoice, and completion boundary.
- Added a separate IndexedDB restore journal, per-document persistence barriers, and startup recovery so a browser close during destructive replacement restores the previous workspace and active timers.
- Added cross-tab database-handle close coordination, post-delete enumeration checks, and a durable IndexedDB document registry for historical-doc discovery on browsers without `indexedDB.databases()`.
- Added fixtures for every advertised backup version and normalized recognized legacy invoice shapes in core/archive documents at startup, lazy load, and post-sync boundaries before strict readers filter them.
- Replaced independent per-project rounding with deterministic largest-remainder minor-unit allocation so discounts, shipping, tax, and allocated totals reconcile exactly while client-only rows remain outside project revenue.
- Removed the legacy localStorage preference currency read/write path and threaded the Yjs preference through dashboards, previews, quote generation, task/project/client finance displays, and agent invoice commands.
- Standardized whole-entry allocation on the local start calendar date across billing, dashboards, UI/agent reports, and exports; agent payment-date filtering now uses local dates instead of UTC slicing.
- Added bridge-boundary JSON Schema enforcement for tool calls and approval-token arguments, including required fields, types, enums, nested arrays/objects, minimum items, and closed-object properties.
- Re-audited command and MCP catalogs: billing mutations require read/write/billing plus approval, invoice email metadata mutation requires read/write/email plus approval, non-mutating quote email requires read/email plus approval, and downloads require export.
- Full unit/integration baseline now passes with 1,768 tests across 206 files.
- At this interim point, focused regressions, all 1,746 unit/integration tests, production app/public-site build, and lint passed; the broader release gates were still pending.

### 2026-07-11 — Assurance completed

- Closed the final Manual-mode gap: a pristine bootstrap pull performs no Drive writes, including manifest-recovery housekeeping.
- Made post-sync billing/archive reconciliation awaitable, flushed the deltas it creates before reporting success, and persisted retry evidence for pull or consistency failures.
- Bound persistent agent grants to the configured stable agent ID and exposed requested scopes in the browser before pairing approval.
- Reconciled the human-readable millisecond timing, billing-increment, two-decimal accounting, exchange snapshot, and report precedence policy.
- Passed 1,789 unit/integration tests across 206 files, coverage (94.22% statements overall; all governed hook/utility files above threshold), lint, production app/public-site build, 34 browser smoke tests, 2 production PWA/offline smoke tests, and the packaged bridge/bundle/live-agent release flow.
- Final pre-ship review found no unresolved Critical or High issue in the remediated scope. Remaining `spec/ambiguities.md` entries concern future product features or compatibility-policy evolution.

### 2026-07-12 — Legacy billing parity follow-up

- Reproduced a production badge/composer mismatch with a new synthetic backup containing no customer data.
- Centralized invoice eligibility for project/client badges, UI composition, and agent preview/draft paths.
- Preserved late-sync safety: only an exact finalized legacy invoice period/task-duration match suppresses markerless historical entries; ambiguous and later-created entries remain eligible.
- Added focused domain, UI-calculation, agent-parity, preview, and real backup-import regressions.
- Passed the full Docker release gate: lint, 1,812 tests across 208 files with 94.28% statement coverage, 34 browser smoke tests, 2 production PWA/offline smoke tests, and production app/public-site builds. The packaged bridge/bundle/live MCP release flow also passed, including invoice preview, draft, finalization, and post-finalization eligibility.

### 2026-07-13 — Shared-operation production follow-up

- Removed the recurring-task stale-skip mutation path so occurrence status is a pure read and sync cannot turn local cleanup into a destructive remote update.
- Added fail-closed identity guards for UI and agent creates so a caller-provided ID cannot replace an active or loaded archived record.
- Centralized protected expense deletion and made paid foreign-currency expense writes prepare a valid exchange snapshot before any durable mutation.
- Made recurring expense generation retry-safe: failed creation leaves the cursor unchanged, and deterministic occurrence IDs prevent duplicate materialization.
- Made agent summary/unbilled/recent queries await historical and archived documents and share canonical invoice eligibility, legacy billing evidence, and billable-duration calculations with the app.
- Passed 1,858 tests across 214 files with 93.96% statement coverage, lint, 34 browser smoke tests, 2 production PWA/offline smoke tests, and production app/public-site builds. The packaged bridge, managed bundles, and live MCP release flow also passed, including timer lifecycle, manual time creation, invoice preview/finalization, and post-finalization unbilled reconciliation.
- Final pre-ship review found no unresolved Critical or High issue in the shared-operation scope.

### 2026-07-13 — Zero-diagnostic typecheck follow-up

- Cleared all 87 diagnostics from the existing repository-wide `tsc --noEmit` run, including stale ambient declarations and contract drift across persisted entities, date preferences, reports, invoices, sync, and agent transport/commands.
- Recovered one runtime-relevant project-note behavior exposed by the type audit: `useProjects.updateProject` now forwards the local-only Yjs transaction origin used to defer note-only sync scheduling, with a focused regression preserving ordinary two-argument callers.
- Added `make typecheck` and made it mandatory in the npm and Makefile release gates; requirements, acceptance, contributor guidance, and architecture documentation now record that contract.
- Passed the full Docker release gate: lint, zero-diagnostic typecheck, 1,859 tests across 214 files with 93.96% statement coverage, 34 browser smoke tests, 2 production PWA/offline smoke tests, and production app/public-site builds.
- Passed the packaged bridge, managed bundle, and live MCP release flow, including timer lifecycle/recovery, manual billable entry creation, invoice preview/finalization, and post-finalization unbilled reconciliation.
- Detected and closed an artifact-only release gap by comparing the built bridge with the managed bundle copies: prepared `@tasktimepro/agent-bridge` 0.2.0 and the OpenClaw/Claude 0.2.0 bundles, refreshed both vendored bridges byte-for-byte, and repeated the bundle/live-agent validation.

### 2026-07-13 — Time-entry display parity follow-up

- Replaced the dashboard time-entry widget's minutes-only formatter with the seconds-aware formatter already used by tasks and detailed time-entry views; valid sub-minute entries now render as values such as `45s`, mixed durations as `1m 5s`, exact-minute durations remain compact, and non-positive intervals show `0s`.
- Added a focused component regression covering sub-minute, mixed, exact-minute, and zero-length durations.
- Passed the full Docker app release gate: lint, zero-diagnostic typecheck, 1,860 tests across 215 files with 93.96% statement coverage, 34 browser smoke tests, 2 production PWA/offline smoke tests, and production app/public-site builds.

### 2026-07-15 — Invoice cancellation v1.2.0 release preparation

- Re-ran the full Docker release gate after the final cancellation-dialog accessibility and layout polish: lint, zero-diagnostic typecheck, 1,914 tests across 218 files with 93.99% statement coverage, 36 browser smoke tests, 2 production PWA/offline smoke tests, and production app/public-site builds all passed.
- Rebuilt and passed the packaged bridge, managed-bundle, and live paired-browser MCP flow through approved invoice cancellation, canceled reporting, and released-source parity.
- Verified `@tasktimepro/agent-bridge@0.3.0` and `@tasktimepro/openclaw@0.3.0` with package-directory `npm pack --dry-run`; the rebuilt bridge remains byte-identical to both managed vendored copies.
- Committed and tagged the complete local release as `v1.2.0`; remote push, package/registry/marketplace publication, GitHub release creation, and production deployment remain pending separate authorization.
