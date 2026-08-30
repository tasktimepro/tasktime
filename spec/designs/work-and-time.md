# Work And Time Experience Design

## Goal

Minimize the distance from identifying work to tracking it accurately.

- Dashboard surfaces current priorities, metrics, recent work, and timer state.
- Project detail groups project context, notes, task list/kanban, estimates, and time actions.
- Task hierarchy remains scannable; subtask actions do not imply unsupported recurrence.
- Planner organizes references by week/day and supports desktop columns plus mobile day navigation.
- Global timers show project/task identity, elapsed state, and clear pause/resume/stop actions.

## Critical interaction states

- Starting when another timer exists for the same project must resolve through the established guard behavior.
- Paused timers remain visibly distinct from running timers.
- Stop and manual-entry flows validate dates/times and preserve notes.
- Empty projects, completed/archived tasks, recurring occurrences, and missing referenced entities have explicit presentations.

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
