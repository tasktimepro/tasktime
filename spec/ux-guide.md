# UX Guide

## Experience model

The app is an operational workspace, not a marketing dashboard. Users should be able to move quickly from planned work to a running timer, then from recorded work to billing and reporting.

## Primary journeys

1. **Start work:** Dashboard or planner → project/task → start timer → global timer remains visible → pause/resume/stop.
2. **Organize work:** Clients/projects → create/edit task hierarchy → choose list/kanban → plan dated work and goals.
3. **Bill work:** Invoices → choose client/project/unbilled items → review draft → finalize/export/send → record payment or undo supported latest invoice.
4. **Manage costs:** Expenses → capture/category/recurrence/payment → tax period → reports/accountant export.
5. **Protect data:** Account → export/import or Drive connection → choose manual/backup/sync → understand status/error/recovery.
6. **Connect agent:** Account agent settings → launch/discover bridge → pair → inspect scopes/approvals → revoke when needed.

## Navigation

- Desktop uses persistent app navigation and contextual page actions.
- Mobile uses top/bottom navigation, sheets, and task-appropriate layouts while preserving the same routes and behavior.
- The running-timer surface remains reachable across primary areas.
- Deep links to projects, clients, planner weeks, and account sections must survive reload/back/forward navigation.

## Interaction rules

- Short focused edits may use dialogs; complex billing/settings flows need sufficient page or large-modal space.
- Destructive actions show consequences and use preview/cascade information where relationships are affected.
- Financial previews separate editable draft state from committed billing mutations.
- Sync modes explain whether they pull, push, or require explicit “Sync Now.”
- Loading, empty, offline, validation, partial-failure, and success states must be visible and actionable.

## Accessibility and responsiveness

Follow `rules/design-discipline.md`. Preserve semantic structure, labels, keyboard access, focus visibility, contrast, touch sizing, safe-area handling, and non-color cues. Adapt information density for larger screens instead of stretching mobile cards indefinitely.
