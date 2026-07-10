# Acceptance Criteria

## Local-first and compatibility

- A returning user can open an existing supported IndexedDB dataset after an upgrade without clearing browser data.
- A supported historical backup or Drive record is validated/migrated and retains valid relationships.
- Offline use allows local work; unavailable cloud actions fail visibly without corrupting local state.
- Reconnecting never silently replaces unsynced valid local work with an older remote snapshot.

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
- Payment and unpaid transitions update invoice/report behavior consistently.
- Undo restores only the supported latest invoice effects and is safe against repeated invocation.
- Quote preview/export/send does not mark work billed.
- Expense and tax state transitions are explicit and reflected consistently in reports/exports.

## Reports and portability

- Equivalent filters produce consistent on-screen, CSV, PDF, and accountant-pack totals.
- Backup export excludes auth/session secrets.
- Import preview reports validation issues before mutation.
- Accepted import preserves supported records and relationships; rejected input leaves current data unchanged.

## Sync modes

- Manual mode auto-connects but does not normally pull/push without “Sync Now,” except documented pristine-device bootstrap.
- Backup mode automatically pushes pending local changes and does not automatically pull normal remote changes on focus/online triggers.
- Sync mode performs bidirectional work on documented triggers with cooldown and cross-tab locking.
- “Sync Now” forces a full pull/push in every mode.

## Agent bridge

- A non-loopback bind is rejected or requires an explicitly supported safe configuration.
- An unpaired, expired, revoked, out-of-scope, over-limit, or unapproved request cannot execute a protected command.
- A paired allowed command produces the same business effect and validation as its UI counterpart.
- Session tokens do not appear in status files, launch URLs, logs, docs, or error recovery payloads.
- The installed integration can complete the long-running task/start/work/stop/verify flow.

## Quality evidence

- Behavior changes start with a failing focused test and finish with the relevant Docker-backed green checks.
- Persisted, sync, billing, reporting, import/export, and agent changes include negative and compatibility coverage proportional to risk.
- Broad release-sensitive changes pass `make release-gate`.
- Public agent interface changes also pass the agent bridge/bundle smoke path and update generated documentation.
