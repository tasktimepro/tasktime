# Time Tracking

## Behavior

- A timer is keyed by project and references a task plus start, pause, note, and identity metadata.
- Start creates/replaces state only through guarded timer behavior.
- Pause accumulates elapsed duration without creating an entry; resume continues it.
- Stop creates one closed time entry, records reconciliation identity, and removes the timer.
- The active timer editor exposes Start Time, a Today/Yesterday Start Day choice,
  and its note. Existing older timers retain their actual date as a labeled
  choice; the editor does not offer an unrestricted calendar. Older work can be
  recorded through manual time entries. Date selections remain absolute local
  dates when midnight changes the labels, including an open yesterday draft
  that becomes older than yesterday. Yesterday uses calendar-day arithmetic,
  including month/year and daylight-saving boundaries.
- Before saving, the editor previews the selected interval and its duration.
  Running previews advance to now; paused previews retain the fixed endpoint.
  Invalid times, future starts and starts after the paused endpoint show a
  compact error notice with an alert icon and theme-aware danger colors, and
  disable Update Timer. Project overlaps remain rejected on submission. Note-only
  edits preserve the exact stored instant, including sub-second precision and
  repeated DST hours. Focusing and leaving a time-picker field untouched preserves
  its value; only explicitly clearing a field resets it to zero on blur.
- Moving a paused timer's start adjusts its frozen elapsed duration to preserve
  the original pause endpoint; moving it after that endpoint is rejected. UI and
  agent updates persist the same shared operation without changing timer identity.
  Historical starts submitted through the agent API remain supported and adjust
  duration by the same rule. Overlap checks use the entire interval, including
  work in intervening months or years.
- Start edits await complete local entry history and archived task relationships
  before saving through the shared UI/agent write boundary. Future starts and
  overlaps are rejected without mutation; a timer replaced, stopped, resumed or
  edited during that load must be reopened before retrying. The editor reports
  success only after validation and the Yjs write succeed. Note-only edits retain
  the exact interval, permit clearing the note, and do not load or revalidate history.
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
