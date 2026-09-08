# Work And Time Experience Design

## Goal

Minimize the distance from identifying work to tracking it accurately.

- Dashboard surfaces current priorities, metrics, recent work, and timer state.
- Project detail groups project context, notes, task list/kanban, estimates, and time actions.
- The Dashboard Time Entries widget has no hidden date window. It shows the 10 newest available entries, loads the newest archived entry year when the active document is empty, and applies only the project filter exposed in the widget.
- Task hierarchy remains scannable; subtask actions do not imply unsupported recurrence.
- Planner organizes references by week/day and supports desktop columns plus mobile day navigation.
- Global timers show project/task identity, elapsed state, and clear pause/resume/stop actions.

## Critical interaction states

- Starting when another timer exists for the same project must resolve through the established guard behavior.
- Paused timers remain visibly distinct from running timers.
- Stop and manual-entry flows validate dates/times and preserve notes.
- Empty projects, completed/archived tasks, recurring occurrences, and missing referenced entities have explicit presentations.

## Dashboard overview

- Desktop shows four summary cards above Today and Upcoming; the two action
  panels sit side by side at `xl` (3:2), stretching to equal height. Below `md`,
  actual DOM order is Today, Upcoming, the horizontally scrollable summary cards,
  then Reports Overview.
  Tablet uses a two-column summary grid and stacked action panels.
- Summary timeframes are fixed: **Tracked today** is saved actual time with a
  decorative seven-day sparkline; **Tasks due today** excludes completed tasks
  and shows overdue separately; **Unbilled this month** estimates eligible hourly
  work; **Unpaid invoices** includes all sent/overdue invoices, with separate
  links to the existing Outstanding and Overdue buckets. Changing the report
  period does not change these timeframes. Running/paused timers retain their
  existing controls and are not added to saved-time totals.
- Upcoming moves the existing next-seven-day task/expense occurrences into its
  own panel, ordered by date. Show five initially and expose all remaining items
  through Show all/Show less. Completion, recurrence dates, timer guards, expense
  previews and Mark paid continue through the existing action handlers.
  Its empty state uses a compact 32px icon and “Nothing coming up” without a
  description, centered vertically in the available panel body.
- Reports Overview has one preset selector: This Month, Last Month, Last 90 Days,
  and earlier named months through available history. No custom range or
  period-navigation arrows.
  Four metrics sit beside the daily stacked chart: **Tracked time**, **Unbilled
  amount**, **Received**, and **Expenses**. Dates use local calendar boundaries.
- Each metric card shows a neutral directional trend. Monthly
  selections compare against the whole previous calendar month (including when
  this month is still in progress); Last 90 Days compares with the immediately
  preceding 90 calendar days. Labels identify the comparison and tooltips give
  its dates. Compact labels use “vs last month” or “vs last 90d”. Equal values
  show No change; a zero baseline shows New; unavailable comparisons show N/A.
  Trends stay on one line, with only the period label ellipsized if space is
  tight; hover text retains the full label and dates. Currency failures or
  incompatible source currencies suppress the percentage.
  Unbilled comparisons use work still eligible today in each period, not a
  reconstruction of past outstanding balances.
- The chart has its own bordered container, matching the combined height of the
  four metric cards on desktop. Its billable/non-billable legend is right-aligned
  beside “Hours tracked”; the chart header does not duplicate the first card's
  total or trend. The Y axis starts at zero, with an 8h minimum
  ceiling, increasing to the next whole hour of the largest daily stacked total
  (8.5h becomes 9h). The visible daily-values dropdown is removed; exact values
  remain available through keyboard/touch tooltips and a screen-reader table.
- The chart and Tracked time use completed entries' actual intervals, grouped
  wholly by local start date, including archived and already invoiced work.
  Invoice adjustments and deleted/invalid intervals do not count as worked time.
  Current task billability splits each day into billable/non-billable; missing
  task links retain actual time as non-billable. Zero-work days remain visible.
  This is distinct from billing-rounded eligible duration used by Unbilled amount.
- Unbilled amount uses canonical invoice eligibility, including legacy finalized
  invoices, snapshots, late entries and cancellations. It is an hourly estimate;
  time without an hourly rate is disclosed, not silently priced. Received uses
  the canonical paid timestamp; Expenses uses paid gross amounts by expense date
  through today. Reports omit upcoming-expense estimates; future auto-paid
  expenses never count as already spent. Scheduled task/expense occurrences
  remain in the separate Upcoming panel.
- Paid conversion snapshots remain authoritative. Missing conversions display
  separate original currencies, never a sum of incomparable amounts. Offline
  rate failure settles without continuous retries. History has explicit loading,
  error and Retry states; a stale period must not be shown as the selected one.
- History reads validated existing active/archive maps and only required entry
  years for both the selected and comparison periods, extending source intervals
  for legacy invoice matching. It observes
  edits, reloads sources when a legacy invoice arrives, and uses existing store
  loaders and provider mode rules. No new document, persisted field or reset.
- This dashboard remains Free. The distinct `/reports` Free Overview and advanced
  report entitlement boundary remain unchanged. Other dashboard widgets retain
  their existing scope, including the newest-ten time-entry list and expense window.

## Planned active-client limit interaction

- Free supports one active client (`archived !== true`); Trial/Pro support
  unlimited active clients. At the limit, every create or unarchive entry point
  remains discoverable and explains the boundary with **Archive a client** and
  the canonical trial/Pro action instead of silently disabling controls.
- Editing, viewing, using, exporting, archiving, and deleting existing clients
  remain available. Imported, restored, synced, downgraded, or concurrently
  merged over-limit state is shown honestly and never auto-corrected by hiding,
  deletion, or archival.
- A form already in progress retains its draft if count/entitlement changes.
  After trial/purchase, return to that intent, revalidate, and require a fresh
  **Create client** or **Restore client** action; never mutate automatically.
