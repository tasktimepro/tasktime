# Time Tracking

## Behavior

- A timer is keyed by project and references a task plus start, pause, note, and identity metadata.
- Start creates/replaces state only through guarded timer behavior.
- Pause accumulates elapsed duration without creating an entry; resume continues it.
- Stop creates one closed time entry, records reconciliation identity, and removes the timer.
- The active timer editor exposes a local Start Date and Start Time plus its note.
  Date defaults to the existing timer start, and changing it explicitly supports
  previous-day work. Future starts, invalid dates, nonexistent daylight-saving
  times and project overlaps remain rejected. Note-only edits preserve the exact
  stored instant, including sub-second precision and repeated DST hours.
- Moving a paused timer's start adjusts its frozen elapsed duration to preserve
  the original pause endpoint; moving it after that endpoint is rejected. UI and
  agent updates persist the same shared operation without changing timer identity.
- Manual entries support explicit start/end and notes.
- Individual time-entry durations use the same seconds-aware display as task durations, so sub-minute work is shown in seconds instead of as `0m`.
- Hours-report project totals and billable totals use that same seconds-aware display while CSV hour columns remain numeric decimal-hour exports.
- Reports and billing may calculate adjusted/billable duration while raw interval semantics remain intact.
- Every UI stop surface and the agent stop command use the same replay-safe stop plan. A paused stop closes at `start + paused elapsed` rather than wall-clock stop time; the plan snapshots the project's billing increment, validates against complete local entry history, records timer reconciliation identity, and reuses an existing stopped entry on retry.
- Timer-created entry IDs derive deterministically from the timer key and timer-instance identity. Concurrent devices stopping the same timer therefore converge on one Yjs entry key, while legacy timers without an instance ID remain recoverable through their stable start/task identity.
- User/agent manual entry mutations load complete local entry history and active plus archived tasks before applying shared range, project-overlap, billing-cutoff, billed-record, and billable-duration validation. Reassignment preserves the source task's billing lock, and unrelated edits preserve legacy duration snapshots unless an explicit clear is requested. Internal invoice/cascade workflows retain their explicit application paths rather than masquerading as manual edits.

## Edge cases

- Duplicate/replayed stop operations, orphaned cross-document state, page reload, day rollover, multiple projects, paused elapsed time, overlap, and invalid ranges require deterministic handling.
- Billing increments snapshot the applied rule so later preference changes do not rewrite billed history.

## Evidence

`useTimers` guard/state tests, `YjsStore` stop reconciliation, timer workflow integration/E2E tests, dashboard and Hours-report display tests, overlap/date/duration utilities, invoice/report tests, and agent timer command tests.
