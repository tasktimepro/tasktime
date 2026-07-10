# Data Protection And Sync Experience Design

## Goal

Make backup, import, Drive connection, and sync-mode consequences understandable without requiring knowledge of CRDT internals.

- Account settings explain local-first ownership and that cloud connection is optional.
- Manual, backup, and sync modes state whether automatic triggers pull, push, or do neither.
- “Sync Now” remains an explicit full reconciliation action in all modes.
- Status distinguishes connecting, checking, downloading, uploading, offline, idle, and error phases.
- Backup import uses preview/validation before applying data.
- Account-wide deletion and Drive revocation remain separate explicit operations.

Errors provide recovery steps without suggesting browser/Drive resets as a routine fix.
