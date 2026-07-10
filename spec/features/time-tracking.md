# Time Tracking

## Behavior

- A timer is keyed by project and references a task plus start, pause, note, and identity metadata.
- Start creates/replaces state only through guarded timer behavior.
- Pause accumulates elapsed duration without creating an entry; resume continues it.
- Stop creates one closed time entry, records reconciliation identity, and removes the timer.
- Manual entries support explicit start/end and notes.
- Reports and billing may calculate adjusted/billable duration while raw interval semantics remain intact.

## Edge cases

- Duplicate/replayed stop operations, orphaned cross-document state, page reload, day rollover, multiple projects, paused elapsed time, overlap, and invalid ranges require deterministic handling.
- Billing increments snapshot the applied rule so later preference changes do not rewrite billed history.

## Evidence

`useTimers` guard/state tests, `YjsStore` stop reconciliation, timer workflow integration/E2E tests, overlap/date/duration utilities, invoice/report tests, and agent timer command tests.
