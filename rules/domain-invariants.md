# TaskTime Pro Domain Invariants

These invariants summarize critical production contracts. They supplement the detailed behavior in `AGENTS.md`, tests, code comments, and public documentation.

## Persistence and sync

- Existing IndexedDB, Yjs documents, backups, Google Drive state, and Dropbox state are live customer data.
- Persisted schema changes are additive or migrated; readers tolerate supported historical shapes.
- Old remote or backup state can return after a local upgrade, so compatibility belongs in validation, import, migration, and sync paths.
- Manual, backup, and sync modes retain the trigger behavior documented in `AGENTS.md`.
- Normal unchanged sync must remain request-efficient. A foreground event inside the cooldown makes zero Worker/provider requests. Once the cooldown expires, a clean unchanged check makes at most one lightweight manifest-metadata request, advances the local successful-check timestamp, and performs no document download, upload, manifest save, backup listing, or full provider-namespace listing. Any additional normal-path request requires a correctness or measured reliability justification plus request-count regression coverage.
- Tab-visible and browser-online signals within one second are one foreground wake window: they perform one eligibility check and at most one sync pass. A later online event remains eligible to recover from a genuine network transition or failed pass.
- Persist unsynced local identity per document and scope operational recovery by provider plus connection generation. An interrupted pull or consistency retry is not evidence that every loaded document changed, and recovery must never promote unrelated documents to full-state upload. Boolean-only and disconnected-doc legacy records remain conservatively readable as generation-zero Google only; another provider/generation must neither consume nor clear them.
- A forced verification pass performs at most one required full-state write per document. When exact dirty-document recovery already requires that write, verification reuses it rather than issuing a duplicate provider request.
- In the provider-neutral implementation, the lifecycle-selected cloud session is
  also the hosted-service authentication session. An inactive provider must not
  remain required for email, metrics, agent email, or future Pro access.
- Provider transfer links the two authenticated provider subjects only after
  target readback/source recheck and before publishing the source move marker.
  Identity-link failure leaves the source active; success preserves one opaque
  hosted principal and locally disconnects the former provider without revoking
  its grant or deleting retained source files.
- A verified moved-source marker is a terminal reconnect fence, not a generic
  provider failure. The recorded destination is the primary recovery path and
  must not delete or mutate the retained source.
- Reusing a moved source is an explicit destructive replacement, never a merge.
  It verifies the expected target, deletes and verifies source backups and sync
  objects with the marker last, leaves the target provider untouched, and seeds
  the complete local IndexedDB workspace with one push-only full-state pass.
  Marker-free resume is allowed only after the source sync namespace is empty;
  durable dirty-document evidence owns recovery until the seed succeeds.
- Page hide or exit while a sync is active must not enqueue a duplicate forced pass. The active pass owns updates produced during that pass, while durable per-document recovery owns genuinely interrupted local work.
- Genuine pending local work blocked by an active sync or occupied cross-tab lock must retry after the current pass can release the lock, using bounded backoff. Clean checks and failed network/conflict passes must not create background retry loops.
- An externally requested lazy-document load must wait for an active provider sync to finish before it performs provider or manifest work. A lazy load initiated by that sync's own completion callback joins the owning pass and defers its manifest commit to the owner, so two revision-sensitive manifest writes cannot overlap or deadlock.
- A sync cannot report success until required cross-document reconciliation has completed and any deltas it creates have been flushed; failures retain durable retry evidence.
- Reconciliation and persisted-data normalization are idempotent: once records are settled, another pass emits no Yjs changes and therefore schedules no upload.
- Destructive resets, claims, archive moves, and conflict recovery must not auto-propagate in ways that undo valid work on another device.
- Connected-provider cleanup is provider-neutral and strictly ordered: verified
  sync-file deletion, verified backup deletion, confirmed grant revocation, then
  browser disconnect. Account-wide deletion may clear local data only after that
  sequence succeeds; a selected but unreachable provider blocks local-only
  deletion until reconnection.
- Every persisted user-data collection must be represented in complete backup/export paths and in equivalent UI/agent reads where that capability is advertised.

## Time and tasks

- At most one active timer exists per project, while different projects may have active timers concurrently.
- Pausing preserves elapsed time and does not create a time entry; stopping creates the entry exactly once.
- Time calculations must use a consistent unit and preserve exact stored duration semantics across timers, entries, reports, invoice billing evidence, imports, and exports. Invoice-facing presentation and pricing intentionally ignore sub-minute source remainders while retaining the exact selected milliseconds in the billing snapshot.
- Tasks belong to projects, subtasks use `parentTaskId`, and subtasks cannot be recurring.

## Invoices, expenses, and reporting

- Invoice calculations, billed state, payments, undo operations, currency handling, expense inclusion, and report totals must agree on the same source records and rounding rules.
- Current billing and report ranges assign a time entry wholly to the local calendar date of its start timestamp and include the complete selected end date. Historical snapshot-less invoice recovery retains the period-boundary behavior that produced the invoice's stored source totals.
- UI badges, invoice composition, and agent preview/draft commands share one invoice-eligibility operation. Neither a task cutoff alone nor entry markers alone may redefine legacy eligibility: exact finalized-invoice evidence may suppress markerless historical entries, while ambiguous or later-arriving work remains eligible.
- Raw time remains millisecond-exact. Billing increments affect an explicit billable-duration snapshot, not the source interval. Invoice hours derive from whole billable minutes and then use the existing two-decimal-hours presentation; an untouched canonical value is not a reduction or adjustment. Financial records use deterministic two-decimal accounting precision and preserve conversion snapshots used for finalized values.
- Billing mutations must be explicit, reversible where supported, and idempotent against retries or repeated commands.
- Cancellation is the terminal void-like exception to ordinary reversibility: only finalized unpaid sent/overdue invoices may be canceled; the retained invoice number, original values/snapshots, and project links are immutable, only sources still owned by that invoice are released, and template numbering is never rewound.
- Canceled invoices remain audit records but contribute zero to revenue, payment, output-tax, profit, outstanding, overdue, aging, statement, and project-allocation totals. They cannot be edited, paid, emailed, undone, uncanceled, or rendered without an unmistakable canceled treatment.
- Invoice references use `project.invoiceIds[]`; invoices are separate entities rather than embedded project records.
- Import/export must preserve supported entity relationships and reject or safely normalize malformed external data without silently losing records.

## Agent bridge and repository boundary

- The browser app remains the mutation owner; MCP tools expose business actions rather than raw storage access.
- UI and agent business capabilities must remain in audited parity and use shared domain/application operations wherever both surfaces support the action; duplicated mutation or calculation logic is a correctness defect.
- The bridge stays loopback-only and requires explicit pairing, scopes, approvals, and revocation.
- Pairing codes remain single-use and short-lived. App-session bearer tokens remain bounded and may exist only in active memory, current-tab `sessionStorage`, and the live bridge session map; they must never enter logs, status files, IndexedDB, Yjs, Drive, backups, exports, docs, diagnostics, or recovery payloads.
- Same-browser agent reconnect uses proof of possession, never stable identity or a persisted bearer token. Its private key is non-exportable, origin-local, sign-only, isolated from product/synced storage, and paired with an in-memory bridge authorization that is scope-, origin-, instance-, expiry-, and revocation-bound.
- Private Worker source, deployment state, raw provider identifiers, secrets, and internal operational runbooks remain outside the public repository.

Changes touching these areas require focused regression coverage and the relevant broader release checks.
