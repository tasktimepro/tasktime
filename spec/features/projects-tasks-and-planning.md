# Projects, Tasks, And Planning

## Behavior

- Projects group tasks, notes, client preference, pricing, billing increments, view/sort preference, quote state, deadline, budget, archive state, and invoice references.
- Clients hold contact/invoice defaults and can relate to multiple projects/expenses/invoices.
- Tasks may be top-level or subtasks, with billable state, estimates, ordering, completion, archive, start date, and supported recurrence metadata.
- Planner attachments reference existing clients/projects/tasks/expenses by date; daily and weekly goals track planned outcomes.

## Edge cases

- Cascade previews enumerate affected relationships before destructive deletion.
- Archived entities remain recoverable through their supported unarchive flows.
- Missing/legacy optional fields use compatible defaults.
- Recurring state reset/skip logic must not overwrite a valid occurrence state from another device.
- Subtasks cannot become recurring.

## Evidence

Relevant hooks/components/domain deletion modules and their tests, planner tests, project notes tests, and Playwright project/task flows.
