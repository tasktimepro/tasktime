# TaskTime Pro Sync Source Of Truth

This file is the source of truth for TaskTime Pro cloud sync behavior. Read it before changing Yjs storage, Google Drive sync, import/export, backups, account deletion, or sync UI.

Handled production incident captures are documented in the private operations runbook. Update that runbook when adding or removing sync/auth/persistence incidents.

TaskTime Pro is in production. Existing IndexedDB and Google Drive appDataFolder state is live customer data. Changes must be backwards compatible and must not require users to clear local storage or Drive files.

## Architecture

- Storage is local-first Yjs CRDT data persisted in IndexedDB.
- Drive sync stores Yjs base-state files, delta files, and one manifest in Google Drive appDataFolder.
- Sync calls go through the Cloudflare Worker when a session ID exists.
- JSON backups are separate snapshot files. They are not Yjs sync files and must not be deleted by ordinary sync cleanup.
- Import/export uses the Yjs store, not separate localStorage state.

## Documents

- `core`: projects, active tasks, active invoices, clients, business data, templates, expenses, recurrences, preferences, timers, planner data.
- `entries-active`: recent time entries.
- `entries-{year}`: historical time entries loaded on demand.
- `tasks-archived`: archived tasks loaded on demand.
- `expenses-archived`: archived expenses loaded on demand.
- `invoices-archived`: archived invoices loaded on demand.

When adding a document, update export/import, Drive sync, validation, local clear/delete, tests, and this README.

## Sync Modes

| Trigger | Manual | Backup | Sync |
| --- | --- | --- | --- |
| Local edit | No auto-sync | Push-only, debounced | Push with manifest check, debounced |
| Tab focus | No auto-sync | Push pending local changes only | Pull+push, cooldown guarded |
| Network online | No auto-sync | Push pending local changes only | Pull+push, cooldown guarded |
| Periodic interval | None | None | Pull+push every 15 minutes |
| Page reload connect | Connect only, except a pristine first device may do one bootstrap pull | Initial pull if remote data exists, otherwise push dirty docs | Pull+push |
| Sync Now | Pull+push forced | Pull+push forced | Pull+push forced |
| Reconnect after disconnect | Connect only | Push dirty docs on connect | Push dirty docs on connect |

Mode rules:

- Manual means user-controlled. Do not pull or push automatically after connect/reload unless the user clicks Sync Now, except for a one-time bootstrap pull on a pristine device so existing Drive data appears immediately after first connect.
- Backup means push-only by default after connect. It must not overwrite changed remote Drive state without requiring Sync Now first.
- Sync means bidirectional. It should merge remote changes and push local changes.
- All modes must preserve pending local changes after failed uploads.

## Efficiency Contract

Sync must stay fast and Worker-friendly.

- Normal sync checks manifest `modifiedTime` first.
- If the manifest is unchanged, do not download document files.
- Do not call full appDataFolder listing on unchanged/no-op syncs. A manifest write may list files once to merge concurrent writer evidence safely.
- `listAppDataFiles()` is for connect/load, backup listing, wipe, and stale-file recovery.
- Keep periodic sync at 15 minutes unless there is a measured reason to change it.
- Keep foreground sync cooldowns so focus/online events do not spam the Worker.
- Use Web Locks to avoid duplicate cross-tab sync.
- Use one merged delta per queued doc batch instead of uploading every Yjs update separately.
- Only run full-state upload when required: initial state, disconnected dirty docs, interrupted sync recovery, or compaction.

Reliability can add checks, but heavy checks must stay off the normal no-change path.

## Merge And Validation Rules

- Yjs CRDT updates are the authority for normal concurrent edits/deletes.
- Remote updates should be rejected only if the binary update is corrupt.
- Reference-integrity validation warnings must not block CRDT convergence.
- Invalid entities should be filtered or normalized at read/import boundaries.
- Cross-document references can be temporarily incomplete while lazy docs load.
- Do not add non-CRDT overwrite behavior for normal sync.

## Manifest And File Rules

- Save manifest references only after the referenced file upload succeeds.
- Do not delete delta files before the manifest no longer references them.
- Before overwriting an existing manifest, merge the latest remote revision with the local mutation and the authoritative uploaded-file list.
- Manifest revisions and write identities are additive diagnostics; delta-file union and base-file `modifiedTime` evidence prevent stale version metadata from hiding remote work.
- Compaction records bounded delta tombstones so a stale concurrent writer cannot resurrect references while the compacted files are being removed.
- If cached Drive file IDs return 404, refresh the file cache and retry before treating the file as missing.
- Searches and listings must exclude trashed files.
- A referenced missing/corrupt file makes reconciliation incomplete; do not report sync success or silently prune it as though it was applied.
- Manifest save failures must leave sync state visible as failed and preserve retry state.

## Pending Local Changes

- Local Yjs updates are queued as pending deltas while connected.
- Local edits made while Drive is disconnected are tracked as disconnected dirty docs in localStorage.
- Dirty docs must be marked for full-state upload on reconnect.
- Dirty markers may clear only after Drive is not `offline` or `error` and the provider reports no local changes left to push.
- Failed sync must not make UI flows behave as if sync succeeded.

## Import And Export

Manual export:

- If Drive is connected, refresh from cloud first.
- If cloud refresh fails, do not create the export.
- Include active data, archived docs, historical `entries-{year}` docs, preferences, planner data, templates, expenses, invoices, and business data.
- Active timer sessions are live stopwatch state, not durable backup records. Warn users to stop timers before export if they need that time saved.

Import:

- Import replaces this device's local Yjs data only.
- It does not replace existing Drive data while connected.
- The safe cloud-reset path is: export, Wipe Drive & Disconnect, import while disconnected, reconnect, then verify sync completes.
- Import must route archived/historical entities to their correct docs.
- Imported disconnected docs must remain queued for full-state upload until Drive confirms no pending work remains.

## Wipe, Disconnect, And Delete-All

- Never auto-sync destructive resets across devices.
- Wipe Drive & Disconnect deletes sync files only by default and preserves backup snapshots.
- Wipe Drive & Disconnect may delete backup snapshots only when the user explicitly selects that option.
- Delete All Account Data while connected should delete sync files and backup snapshots before revoking Google access and clearing local data.
- Drive wipe must verify non-backup sync files are gone and fail visibly if files remain.
- A Drive wipe is not a global tombstone. A stale already-authorized device can recreate cloud state if it later reconnects with old local data. Do not claim wipe makes old devices impossible to reintroduce without adding a reset-generation/tombstone protocol.

## Backup Snapshots

- Backup snapshots are independent JSON files named `tasktime-backup-...`.
- Backups must not block sync when backup creation fails.
- Automatic backups should be frequency-limited and pruned.
- Backup files should not be touched by normal sync compaction or sync wipe.

## Before Changing Sync

Check these before committing:

- Does this preserve existing IndexedDB and Drive data?
- Does it keep normal no-change sync lightweight?
- Does failed sync preserve pending local work?
- Does UI show failure instead of continuing destructive flows?
- Does import/export include all active, archived, and historical docs?
- Does Drive wipe avoid deleting backups unless explicitly requested?
- Does backup mode avoid pulling except on connect or Sync Now?
- Does manual mode remain user-controlled?
- Are stale Drive file IDs and trashed files handled?
- Are cross-tab and page-exit cases safe?

Recommended tests after changes:

- `make npm CMD="run test:run -- src/stores/yjs/YjsStore.test.js src/stores/yjs/providers/GoogleDriveProvider.test.js src/stores/yjs/providers/ManifestManager.test.js src/stores/yjs/validation.test.js src/stores/yjs/sampleBackupFixture.test.js src/components/sync/YjsSyncSettings.test.jsx src/components/sync/YjsSyncStatus.test.jsx src/components/sync/syncStatusDescriptor.test.js src/components/Account.test.jsx src/utils/syncPersistence.test.js"`
- `make build`
- `make lint`
