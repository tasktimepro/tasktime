# Acceptance Criteria

## Local-first and compatibility

- A returning user can open an existing supported IndexedDB dataset after an upgrade without clearing browser data.
- A supported historical backup or Drive record is validated/migrated and retains valid relationships.
- Offline use allows local work; unavailable cloud actions fail visibly without corrupting local state.
- Reconnecting never silently replaces unsynced valid local work with an older remote snapshot.
- Core use does not require a TaskTime account or cloud sync, and public discovery metadata states that work records use browser-local storage.

## Work and time

- Users can manage clients, projects, tasks/subtasks, notes, planner attachments, and goals through the corresponding screens.
- A subtask cannot be configured as recurring.
- Two projects may have timers concurrently, but a project cannot hold two active timer states.
- Pause/resume preserves elapsed duration without creating an entry.
- Stop creates one entry for the selected task, including the correct interval/note, and clears only that timer.
- Repeating a recovered stop operation does not create a duplicate entry.

## Billing and finance

- Invoice preview includes only eligible selected work/expenses and its totals equal the visible line calculation, adjustments, and tax.
- Finalization applies billing markers once and preserves snapshots needed for reporting/payment/undo.
- A paid invoice exposes an explicitly confirmed **Mark as unpaid** correction that clears its recorded payment date and currency snapshot, preserves its finalized billing-source claims, and returns it to the effective Outstanding or Overdue bucket; the UI makes clear that this does not issue a refund.
- Undo restores only the supported latest invoice effects and is safe against repeated invocation.
- Canceling a sent or overdue unpaid invoice retains its invoice number, original monetary and billing snapshots, sent metadata, project links, and required cancellation reason/time while releasing only time, adjustments, expenses, quote claims, and task cutoffs still owned by that invoice.
- Cancellation is terminal and retry-safe: drafts and paid invoices are refused without mutation, an exact invoice-number confirmation is required, stale replay cannot make a canceled invoice payable again, and a later invoice's source claim or task cutoff is never cleared.
- A canceled invoice appears only in the Canceled invoice-list bucket, is read-only/non-payable/non-emailable, and every preview/export visibly identifies it as canceled; the next invoice never reuses its number.
- Quote preview/export/send does not mark work billed.
- Expense and tax state transitions are explicit and reflected consistently in reports/exports.

## Reports and portability

- Equivalent filters produce consistent on-screen, CSV, PDF, and accountant-pack totals.
- Canceled invoices remain visible in audit/register scopes with original face value and cancellation metadata while contributing zero to financial, tax, payment, outstanding, aging, statement, and project-revenue totals; released eligible sources reappear exactly once in browser and agent unbilled views.
- Backup export excludes auth/session secrets.
- Import preview reports validation issues before mutation.
- Accepted import preserves supported records and relationships; rejected input leaves current data unchanged.

## Sync modes

- Manual mode auto-connects but does not normally pull/push without “Sync Now,” except documented pristine-device bootstrap.
- Backup mode automatically pushes pending local changes and does not automatically pull normal remote changes on focus/online triggers.
- Sync mode performs bidirectional work on documented triggers with cooldown and cross-tab locking, including a lightweight five-minute manifest check only while the app is visible.
- Genuine pending local work that encounters an active sync or occupied cross-tab lock retries after the current pass can release the lock; clean checks and failed network/conflict passes do not create retry loops.
- “Sync Now” forces a full pull/push in every mode.
- The visible sync-status control remains keyboard-operable while loading, connecting, checking, downloading, uploading, or syncing and opens Account > Cloud Sync without starting a duplicate sync.
- A transient Google-grant revocation, token refresh, rate-limit, or Drive-status failure keeps the retryable session and does not claim that access was revoked; confirmed revocation clears it, while explicit local disconnect remains available separately.
- A direct connection keeps its access token only in active-tab memory and sends ordinary Drive file requests directly to Google. Ambiguous writes are never replayed through the Worker.

## Agent bridge

- A non-loopback bind is rejected or requires an explicitly supported safe configuration.
- An unpaired, expired, revoked, out-of-scope, over-limit, or unapproved request cannot execute a protected command.
- A paired allowed command produces the same business effect and validation as its UI counterpart.
- Session tokens do not appear in status files, launch URLs, logs, docs, or error recovery payloads.
- The installed integration can complete the long-running task/start/work/stop/verify flow.
- The discovery manifest and generated tool catalog agree on core-use, privacy, and canonical first-party ClawHub metadata.

## Quality evidence

- Behavior changes start with a failing focused test and finish with the relevant Docker-backed green checks.
- Persisted, sync, billing, reporting, import/export, and agent changes include negative and compatibility coverage proportional to risk.
- Broad release-sensitive changes pass `make release-gate`.
- The repository-wide TypeScript check completes with zero diagnostics as part of `make release-gate`.
- Public agent interface changes also pass the agent bridge/bundle smoke path and update generated documentation.
