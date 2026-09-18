# Projects, Tasks, And Planning

## Behavior

- Projects group tasks, notes, client preference, pricing, billing increments, view/sort preference, quote state, deadline, budget, archive state, and invoice references.
- Clients hold contact/invoice defaults and can relate to multiple projects/expenses/invoices.
- Tasks may be top-level or subtasks, with billable state, estimates, ordering, completion, archive, start date, and supported recurrence metadata.
- Planner project cards omit due-date, overdue, and resolved-deadline badges in desktop and mobile layouts. Quote-stage badges and the separate flag-marked deadline item on its scheduled day remain.
- Planner attachments reference existing clients/projects/tasks/expenses by date; daily and weekly goals track planned outcomes.

## Edge cases

- Cascade previews enumerate affected relationships before destructive deletion.
- Task, project and client cascades use the shared store deletion operation.
  It loads all local history and known cloud documents before planning, validates
  the complete scope before mutation, and removes dependents from every loaded
  placement before removing parents. Persistence barriers separate dependent,
  invoice, bottom-up task, and final project/client mutations; success waits for
  the final barrier. An interruption can leave parents for explicit retry.
- Known but unapplied cloud history blocks deletion with a Sync Now instruction;
  deletion does not override manual or backup pull policy. Invalid stored
  dependencies and unfinished billing operations also block mutation.
- Agent cascades retain exact expected-ID approval and stricter billed/invoice
  guards, using the same billing markers as manual entry protection, including
  legacy billed hourly rates. UI task deletion can explicitly remove billed source time while
  preserving finalized invoice snapshots. Project/client invoice deletion must
  be explicitly selected; shared invoices and tax-claimed expenses remain guarded.
  An invoice still claiming time or quoted work outside the deletion scope blocks
  the cascade rather than stranding those surviving claims.
- Client deletion always asks for confirmation. Failed deletion does not show a
  success notification or navigate away. Relationships arriving during the
  operation are rechecked before the remaining parent is removed.
- This does not infer deletion intent for pre-existing or later-arriving orphans.
  Offline concurrent records remain retained and diagnosed for explicit recovery;
  no new persisted tombstone schema, destructive repair, or deletion journal is added.
- Archived entities remain recoverable through their supported unarchive flows.
- Missing/legacy optional fields use compatible defaults.
- Recurring skip evidence is never cleared by an automatic dashboard/status write. Status derivation only applies a skip to its matching occurrence, so older evidence becomes inactive without a destructive sync update.
- Subtasks cannot become recurring.
- UI hooks and agent commands share creation/update validation: creates fail closed when the selected ID already exists rather than replacing its record; entity identities are immutable; referenced projects/clients/parents must exist; parents remain in the same project; task hierarchies cannot be self-referential or cyclic; and active plus archived descendants participate in move validation. A task with an active timer must be stopped before changing projects.
- Completion, recurring occurrence toggles/skips, and generic task updates share one state operation. Ordinary completion always maintains `completedOnDate`; recurring scalar completion is rejected in favor of an occurrence date; completion clears the matching skip pair; and status reads ignore a skip outside its recorded occurrence without rewriting persisted history.

## Evidence

Relevant hooks/components/domain deletion modules and their tests, planner tests, project notes tests, and Playwright project/task flows.
