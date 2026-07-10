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
