# Data Protection And Sync Experience Design

## Goal

Make backup, import, Drive connection, and sync-mode consequences understandable without requiring knowledge of CRDT internals.

- Account settings explain local-first ownership and that cloud connection is optional.
- Manual, backup, and sync modes state whether automatic triggers pull, push, or do neither.
- “Sync Now” remains an explicit full reconciliation action in all modes.
- A pristine first-device Manual connection may perform its one bootstrap pull but performs no Drive write; recovered manifest housekeeping waits for an explicit sync.
- Status distinguishes connecting, checking, downloading, uploading, offline, idle, and error phases.
- Sync success waits for required archive/billing reconciliation and flushes any deltas that reconciliation creates. A pull or consistency failure remains visible and leaves durable retry evidence across reload/reconnect.
- Backup import uses preview/validation before applying data.
- A replacement restore journals the complete previous workspace and active
  timers in a separate IndexedDB database before deletion. The journal remains
  until every replacement document passes a persistence barrier; startup
  automatically recovers the previous workspace if the browser stopped first.
- Account-wide deletion and Drive revocation remain separate explicit operations.

Errors provide recovery steps without suggesting browser/Drive resets as a routine fix.
