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
- Recurring skip evidence is never cleared by an automatic dashboard/status write. Status derivation only applies a skip to its matching occurrence, so older evidence becomes inactive without a destructive sync update.
- Subtasks cannot become recurring.
- UI hooks and agent commands share creation/update validation: creates fail closed when the selected ID already exists rather than replacing its record; entity identities are immutable; referenced projects/clients/parents must exist; parents remain in the same project; task hierarchies cannot be self-referential or cyclic; and active plus archived descendants participate in move validation. A task with an active timer must be stopped before changing projects.
- Completion, recurring occurrence toggles/skips, and generic task updates share one state operation. Ordinary completion always maintains `completedOnDate`; recurring scalar completion is rejected in favor of an occurrence date; completion clears the matching skip pair; and status reads ignore a skip outside its recorded occurrence without rewriting persisted history.

## Evidence

Relevant hooks/components/domain deletion modules and their tests, planner tests, project notes tests, and Playwright project/task flows.
