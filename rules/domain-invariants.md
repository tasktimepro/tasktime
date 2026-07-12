# TaskTime Pro Domain Invariants

These invariants summarize critical production contracts. They supplement the detailed behavior in `AGENTS.md`, tests, code comments, and public documentation.

## Persistence and sync

- Existing IndexedDB, Yjs documents, backups, and Google Drive state are live customer data.
- Persisted schema changes are additive or migrated; readers tolerate supported historical shapes.
- Old remote or backup state can return after a local upgrade, so compatibility belongs in validation, import, migration, and sync paths.
- Manual, backup, and sync modes retain the trigger behavior documented in `AGENTS.md`.
- Normal unchanged sync must remain Worker-efficient. A foreground event inside the cooldown makes zero Worker/Drive requests. Once the cooldown expires, a clean unchanged check makes at most one lightweight manifest-metadata request, advances the local successful-check timestamp, and performs no document download, upload, manifest save, backup listing, or full app-data-folder listing. Any additional normal-path request requires a correctness or measured reliability justification plus request-count regression coverage.
- Persist unsynced local identity per document. An interrupted pull or consistency retry is not evidence that every loaded document changed, and recovery must never promote unrelated documents to full-state upload. Boolean-only legacy recovery markers remain conservatively readable.
- Page hide or exit while a sync is active must not enqueue a duplicate forced pass. The active pass owns updates produced during that pass, while durable per-document recovery owns genuinely interrupted local work.
- A sync cannot report success until required cross-document reconciliation has completed and any deltas it creates have been flushed; failures retain durable retry evidence.
- Reconciliation and persisted-data normalization are idempotent: once records are settled, another pass emits no Yjs changes and therefore schedules no upload.
- Destructive resets, claims, archive moves, and conflict recovery must not auto-propagate in ways that undo valid work on another device.
- Every persisted user-data collection must be represented in complete backup/export paths and in equivalent UI/agent reads where that capability is advertised.

## Time and tasks

- At most one active timer exists per project, while different projects may have active timers concurrently.
- Pausing preserves elapsed time and does not create a time entry; stopping creates the entry exactly once.
- Time calculations must use a consistent unit and preserve exact stored duration semantics across timers, entries, reports, invoices, imports, and exports.
- Tasks belong to projects, subtasks use `parentTaskId`, and subtasks cannot be recurring.

## Invoices, expenses, and reporting

- Invoice calculations, billed state, payments, undo operations, currency handling, expense inclusion, and report totals must agree on the same source records and rounding rules.
- UI badges, invoice composition, and agent preview/draft commands share one invoice-eligibility operation. Neither a task cutoff alone nor entry markers alone may redefine legacy eligibility: exact finalized-invoice evidence may suppress markerless historical entries, while ambiguous or later-arriving work remains eligible.
- Raw time remains millisecond-exact. Billing increments affect an explicit billable-duration snapshot, not the source interval; financial records use deterministic two-decimal accounting precision and preserve conversion snapshots used for finalized values.
- Billing mutations must be explicit, reversible where supported, and idempotent against retries or repeated commands.
- Invoice references use `project.invoiceIds[]`; invoices are separate entities rather than embedded project records.
- Import/export must preserve supported entity relationships and reject or safely normalize malformed external data without silently losing records.

## Agent bridge and repository boundary

- The browser app remains the mutation owner; MCP tools expose business actions rather than raw storage access.
- UI and agent business capabilities must remain in audited parity and use shared domain/application operations wherever both surfaces support the action; duplicated mutation or calculation logic is a correctness defect.
- The bridge stays loopback-only and requires explicit pairing, scopes, approvals, and revocation.
- Pairing codes and app-session tokens remain short-lived or memory-only as documented; they must never enter logs, status files, docs, or recovery payloads.
- Private Worker source, deployment state, provider identifiers, secrets, and internal operational runbooks remain outside the public repository.

Changes touching these areas require focused regression coverage and the relevant broader release checks.
