# Ambiguities And Open Decisions

Unknowns are recorded here rather than silently resolved by an agent.

## Product decisions

### Invoice cancellation

`TODO.md` proposes cancellation but does not yet define:

- whether cancellation reactivates billed time/expenses or preserves the financial audit trail as consumed
- how canceled invoices affect reports, payments, tax views, and exports
- whether a later invoice may reuse the canceled sequential number
- whether cancellation and “undo latest invoice” are distinct operations and which invoices are eligible

Resolve these before implementation and update billing contracts/tests first.

### Task templates

The backlog proposes global/category-based task templates, but category ownership, synchronization, duplication behavior, update propagation, and import semantics are not specified.

### Timed-session alerts

The backlog does not yet decide whether alerts belong to a timer session, project, task, or account preference, nor their relationship to system/push notification permissions.

## Architecture and operations

### Private architecture sources

`AGENTS.md` references private overview and sync-plan documents when available. They were not present in this public workspace during foundation generation. If they contain constraints not already represented here, reconcile them into the project-owned specs/rules without copying private operational details into the public repository.

### Historical compatibility support window

The repository validates tolerant historical shapes, but there is no single documented minimum supported backup/app version. Do not remove compatibility code until a support policy and migration evidence exist.

### Dedicated agent evals

Agent commands are deterministic and currently use tests/smoke flows. If future integrations add model-authored planning or interpretation inside this repository, define eval fixtures and thresholds before shipping that behavior.
