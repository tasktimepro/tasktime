# Work And Time Experience Design

## Goal

Minimize the distance from identifying work to tracking it accurately.

- Dashboard surfaces current priorities, metrics, recent work, and timer state.
- Project detail groups project context, notes, task list/kanban, estimates, and time actions.
- The Dashboard Time Entries widget has no hidden date window. It shows the 10 newest available entries, loads the newest archived entry year when the active document is empty, and applies only the project filter exposed in the widget.
- Task hierarchy remains scannable; subtask actions do not imply unsupported recurrence.
- Planner organizes references by week/day and supports desktop columns plus mobile day navigation. Attached project items use the shared closed-folder project icon; project deadline markers retain their flag icon. Projects always retain the solid 4px left identity border, using the resolved project/client color when available and the normal neutral border token otherwise. Expense items use a dotted 4px left accent to distinguish them from tasks and projects while keeping the rest of the card border solid. They resolve that accent from the current category record by ID, including recurring previews and archived categories; uncategorized or colorless expenses retain a neutral left accent and never inherit project or client colors.
- Global timers show project/task identity, elapsed state, and clear pause/resume/stop actions.
- Planner project/client attachments use the full available title width while
  their desktop three-dot menu is hidden. Hover, keyboard focus within the card,
  and an open menu reserve action space and ellipsize overflowing titles.
  Leaving both hover and focus restores the width once the menu is closed.
  Phone layouts retain a visible menu beside wrapping titles. Keyboard activation
  of the menu must not also activate the surrounding card.

## Recurrence controls and project settings

- Disable recurrence and Enable recurrence appear only in recurring-task
  three-dot menus used by task details and list views. Disable uses a calendar-off
  icon and Enable uses a calendar-check icon, with the same alignment and spacing
  as adjacent actions, avoiding the
  pause/play icons reserved for timers. Disabled recurring tasks keep clean
  titles. List rows replace the normal recurrence schedule tag with a neutral
  calendar-off `Disabled` tag, and task details show that tag inline after the
  repeat description under Schedule.
  Subtasks and archived tasks do not offer them. Open task editors omit
  menu-owned recurrence control fields when saving; menu actions
  preserve their displayed intent if another device has already changed it.
- Paused schedules remain in project recurring-task lists but do not produce
  Today, Upcoming, overdue, planner due items, or notification schedules.
  Existing completed occurrences and tracked work remain visible in history.
- Resume follows the existing weekly/monthly/yearly schedule from the current
  local date, with no catch-up for missed dates. Timer controls and historical
  billing remain independent. See the optional fields in the data contract.
- Project Billing & Timer Rules and Project Planning appear only after a client
  is selected, then use collapsed sections
  with effective-setting summaries. Billing contains the client-rate notice,
  override checkbox/rate fields, and hourly-only rounding controls; flat-rate
  projects retain access to their rate override. Planning contains project
  status, deadline, and target budget. Collapsing preserves entered values;
  invalid inputs open their section and receive focus. A missing inherited
  hourly rate also opens Billing with an explanation and focuses the override
  control. Hourly overrides must be positive; flat-rate pricing disables that
  hourly input's validation.

## Critical interaction states

- Starting when another timer exists for the same project must resolve through the established guard behavior.
- While an unpaused timer is running, other task rows for that project on the
  Dashboard are non-interactive across Today, Upcoming, and Tasks: completion
  and row actions stay unavailable, the task-title button is natively disabled,
  and an overdue date does not provide a second details-modal entry point. The
  timer-owning task, tasks in other projects, and tasks behind a paused project
  timer remain available.
- Paused timers remain visibly distinct from running timers.
- Planner and global running-timer indicators share the animated danger-color
  dot and an accessible Timer active label.
- Stop and manual-entry flows validate dates/times and preserve notes.
- Empty projects, completed/archived tasks, recurring occurrences, and missing referenced entities have explicit presentations.
- Automatic billable marking, task controls, and Kanban billing badges require
  a non-personal project with a client assignment. Existing task preferences are
  retained when moving work; current-context totals do not rewrite invoice claims.

## Project and client identity

- The Projects page identifies the section with the shared closed-folder icon
  beside the main heading using the neutral muted-foreground token. The blue
  info-accent treatment remains scoped to dashboard section icons. Project card titles stay text-only because their
  existing left borders already carry project identity. Active and archived
  project grids use the same 24px gap as the Clients page. Cards also match the
  Clients page's responsive inset: 16px on phones, then 24px with a 20px top
  inset on larger layouts. Personal, archived, and quote-stage tags sit directly
  after the title; the vertically centered three-dot action remains at the far
  right. Long titles may wrap before displacing either control.
  Cards show their creation date without repeating the recent-activity date;
  recent activity remains available to the existing sort option. The remaining
  details occupy a flexible left column while invoice and deadline pills align
  in a compact right column on the same row. The columns wrap only when a card
  is too narrow, rather than reserving a separate footer. Client-dashboard
  project cards use the same lower-card layout.
- On phone widths, the Projects and Clients headings hide only their
  parenthesized entity totals so the icon, title, sort control, and create action
  remain on the compact header row. Totals return from the `sm` breakpoint.
- Project detail replaces the former color dot beside the title with a closed
  folder. The folder uses the project's exact color, inherits the associated
  client's color when the project has none, and otherwise uses the neutral
  muted-foreground token. This presentation is read-only and does not change
  stored project or client records.
- The Clients page identifies its section with the shared users icon beside the
  main heading using the neutral muted-foreground token. Client detail replaces
  its former color dot with the single-user
  icon used by Planner client attachments, using the client's exact color or the
  neutral muted-foreground fallback.
- A project card's associated client name is an explicit navigation control.
  It shows pointer and underline feedback on hover, a visible keyboard focus
  state, and opens that client without also activating the surrounding project
  card.

## Dashboard overview

- Project names use a small 14px folder outline in the exact project color or
  its associated client's color when the project has none, matching the project
  identity shown by the widget heading. Missing or invalid colors use the neutral
  muted-foreground token. Folder icons are decorative and sit inside the existing
  project-name button without an extra keyboard stop. The client and pending-time
  line aligns with the folder's left edge, matching the Expenses widget's metadata
  alignment. Names retain click/keyboard navigation and truncate on narrow screens.
  Client links, financial values, filters and row padding remain unchanged.

- Today and Upcoming use the shared compact 32px empty-state icon size.
- Unbilled cards in client and project dashboards keep the heading above compact,
  left-aligned icon/amount rows: work first, then expenses when unbilled expenses
  exist. Both rows use 16px muted icons and 14px semibold amounts; Work/Expenses
  labels are available to screen readers without adding visible text. Separate
  currencies can wrap, and an empty unbilled-expense total adds no placeholder
  row. The mobile metric rail stretches neighboring cards to the same height.

- Desktop shows four summary cards above Today and Upcoming; the two action
  panels sit side by side at `xl` (3:2), stretching to equal height. Below `md`,
  actual DOM order is Today, Upcoming, the horizontally scrollable summary cards,
  then Reports Overview.
  Tablet uses a two-column summary grid and stacked action panels.
- Summary timeframes are fixed: **Tracked today** is saved actual time plus
  active timer elapsed time, with a decorative seven-day sparkline; **Tasks due today** excludes completed tasks
  and shows overdue separately; **Unbilled this month** estimates eligible hourly
  work; **Unpaid invoices** includes all sent/overdue invoices, with separate
  links to the existing Outstanding and Overdue buckets. Changing the report
  period does not change these timeframes. Running/paused timers retain their
  existing controls. Only tracked-time displays include their elapsed time.
- Upcoming moves the existing next-seven-day task/expense occurrences into its
  own panel, ordered by date. Its header uses only the `Upcoming` title without
  repeating the seven-day window as subtitle copy. Show five initially and expose
  all remaining items through Show all/Show less. Completion, recurrence dates,
  timer guards, expense previews and Mark paid continue through the existing
  action handlers.
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
  total or trend. Empty periods retain the chart without a message underneath.
  The Y-axis width automatically fits its formatted hour labels, without a fixed
  left gutter or negative margin. The axis starts at zero, with an 8h minimum
  ceiling, increasing to the next whole hour of the largest daily stacked total
  (8.5h becomes 9h). The visible daily-values dropdown is removed; exact values
  remain available through keyboard/touch tooltips and a screen-reader table.
- The chart and Tracked time use saved actual intervals plus active timer
  elapsed time, grouped wholly by local start date (the effective start for
  resumed timers), including archived and already invoiced saved work. Invoice
  adjustments and deleted/invalid intervals do not count as worked time.
- Live time updates once per minute while visible and immediately after timer
  lifecycle changes or returning to the tab. Paused elapsed time remains included
  without increasing. Only Tracked today and its sparkline, selected-period
  Tracked time and its time trend/billable detail, and Hours tracked include live
  time; these cards identify active contributions. Financial metrics and trends,
  other widgets, and the standalone Reports page continue using saved records.
  The projection never writes data or applies billing rounding. Stopped-timer
  identities (including the legacy identity fallback) prevent double-counting
  while a saved entry and its timer temporarily coexist. Clearing a timer
  removes its contribution; stopping replaces it with the actual saved entry.
  A saved billable flag counts only while the task belongs to a non-personal
  project with a matching existing client. Standalone tasks, personal projects,
  and missing project/client links retain actual time as non-billable, including
  live timers. Moves and client changes reclassify the read-only projection;
  they do not rewrite the saved flag, entries, or invoice snapshots. Archived
  client work remains billable under the same relationship rule. Zero-work days
  remain visible.
  This is distinct from billing-rounded eligible duration used by Unbilled amount.
- Unbilled amount applies canonical invoice eligibility against complete source
  history before filtering current project/client billability, including legacy finalized
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
