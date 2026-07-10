# TaskTime Pro Domain Invariants

These invariants summarize critical production contracts. They supplement the detailed behavior in `AGENTS.md`, tests, code comments, public docs, and the private architecture material when available.

## Persistence and sync

- Existing IndexedDB, Yjs documents, backups, and Google Drive state are live customer data.
- Persisted schema changes are additive or migrated; readers tolerate supported historical shapes.
- Old remote or backup state can return after a local upgrade, so compatibility belongs in validation, import, migration, and sync paths.
- Manual, backup, and sync modes retain the trigger behavior documented in `AGENTS.md`.
- Destructive resets, claims, archive moves, and conflict recovery must not auto-propagate in ways that undo valid work on another device.

## Time and tasks

- At most one active timer exists per project, while different projects may have active timers concurrently.
- Pausing preserves elapsed time and does not create a time entry; stopping creates the entry exactly once.
- Time calculations must use a consistent unit and preserve exact stored duration semantics across timers, entries, reports, invoices, imports, and exports.
- Tasks belong to projects, subtasks use `parentTaskId`, and subtasks cannot be recurring.

## Invoices, expenses, and reporting

- Invoice calculations, billed state, payments, undo operations, currency handling, expense inclusion, and report totals must agree on the same source records and rounding rules.
- Billing mutations must be explicit, reversible where supported, and idempotent against retries or repeated commands.
- Invoice references use `project.invoiceIds[]`; invoices are separate entities rather than embedded project records.
- Import/export must preserve supported entity relationships and reject or safely normalize malformed external data without silently losing records.

## Agent bridge and repository boundary

- The browser app remains the mutation owner; MCP tools expose business actions rather than raw storage access.
- The bridge stays loopback-only and requires explicit pairing, scopes, approvals, and revocation.
- Pairing codes and app-session tokens remain short-lived or memory-only as documented; they must never enter logs, status files, docs, or recovery payloads.
- Private Worker source, deployment state, provider identifiers, secrets, and internal operational runbooks remain outside the public repository.

Changes touching these areas require focused regression coverage and the relevant broader release checks.
