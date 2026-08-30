# TaskTime Pro Sync Source Of Truth

This file is the source of truth for TaskTime Pro cloud sync behavior. Read it
before changing Yjs storage, the shared cloud-sync core, either provider adapter,
import/export, backups, account deletion, or sync UI.

Handled production incident captures are documented in the private operations runbook. Update that runbook when adding or removing sync/auth/persistence incidents.

TaskTime Pro is in production. Existing IndexedDB, Google Drive appDataFolder,
and Dropbox App Folder state is live customer data. Changes must be backwards
compatible and must not require users to clear local or provider data.

## Architecture

- Storage is local-first Yjs CRDT data persisted in IndexedDB.
- `YjsCloudSyncProvider`, `CloudManifestManager`, and `CloudBackupManager` own shared behavior. `YjsDriveProvider`, `ManifestManager`, `BackupManager`, and Drive-named store/context APIs remain Google-only compatibility facades. Dropbox entry points and explicit user-initiated provider transfers are deployed/enabled for approved/current accounts, with an explicit false emergency UI opt-out and independent fail-closed Worker endpoint/acquisition/transfer controls. No transfer starts automatically. Broad Dropbox availability to new public users remains gated on Dropbox App Console production access followed by the non-destructive post-approval sign-in/token/direct-file canary.
- The selected provider adapter stores Yjs base-state files, delta files, and one
  manifest in Google Drive appDataFolder or Dropbox App Folder.
- The Worker retains OAuth code exchange, encrypted refresh-token storage, access-token issuance, and revocation. Routine Google Drive and Dropbox requests go directly from the browser to the selected provider.
- In the provider-neutral implementation, the lifecycle-selected
  Google Drive or Dropbox session also authenticates hosted email, privacy-safe
  synced metrics, agent email, and future Pro state. The private Worker derives
  provider-separated hashes and resolves one opaque hosted principal; Dropbox
  does not require a parallel Google session.
- Verified provider transfer links hosted identity after target readback/source
  recheck and before the source move marker. Link failure keeps the source
  active. Successful activation locally disconnects the former session while
  retaining its provider files; later source-provider cleanup remains an
  explicit action outside transfer.
- JSON backups are separate snapshot files. They are not Yjs sync files and must not be deleted by ordinary sync cleanup.
- Import/export uses the Yjs store, not separate localStorage state.

## Documents

- `core`: projects, active tasks, active invoices, clients, business data, templates, expenses, recurrences, preferences, timers, planner data.
- `entries-active`: recent time entries.
- `entries-{year}`: historical time entries loaded on demand.
- `tasks-archived`: archived tasks loaded on demand.
- `expenses-archived`: archived expenses loaded on demand.
- `invoices-archived`: archived invoices loaded on demand.

When adding a document, update export/import, both provider adapters, validation,
local clear/delete, tests, and this README.

## Sync Modes

| Trigger | Manual | Backup | Sync |
| --- | --- | --- | --- |
| Local edit | No auto-sync | Push-only, debounced | Push with manifest check, debounced |
| Tab focus | No auto-sync | Push pending local changes only | Pull+push, cooldown guarded |
| Network online | No auto-sync | Push pending local changes only | Pull+push, cooldown guarded |
| Periodic interval | None | None | Manifest check every 5 minutes while visible; pull+push if changed |
| Page reload connect | Connect only, except a pristine first device may do one bootstrap pull | Initial pull if remote data exists, otherwise push dirty docs | Pull+push |
| Sync Now | Pull+push forced | Pull+push forced | Pull+push forced |
| Reconnect after disconnect | Connect only | Push dirty docs on connect | Push dirty docs on connect |

Mode rules:

- Manual means user-controlled. Do not pull or push automatically after connect/reload unless the user clicks Sync Now, except for a one-time bootstrap pull on a pristine device so existing Drive data appears immediately after first connect.
- Backup means push-only by default after connect. It must not overwrite changed remote Drive state without requiring Sync Now first.
- Sync means bidirectional. It should merge remote changes and push local changes.
- The user-facing Sync Now action performs full-state verification for every loaded document after pulling. Internal refresh-only callers must opt out explicitly when they need current cloud state without rewriting verified bases.
- All modes must preserve pending local changes after failed uploads.

## Efficiency Contract

Sync must stay fast and Worker-friendly.

- Normal sync checks manifest `modifiedTime` first.
- Ordinary local edits debounce for 100ms. Rich project-note edits wait for a 1.5-second typing pause, then use the same automatic mode pipeline; Manual mode keeps every edit local until the user explicitly syncs.
- A clean foreground event inside the cooldown makes zero Worker/Drive requests.
- After the cooldown, a clean unchanged check makes at most one manifest-metadata request. A successful no-op check advances the local cooldown timestamp.
- If the manifest is unchanged, do not download document files.
- An unchanged check must not upload documents, save the manifest, list backups, or list the full appDataFolder.
- Do not call full appDataFolder listing on unchanged/no-op syncs. A manifest write may list files once to merge concurrent writer evidence safely.
- Shared sync paths list only the sync namespace; backup listing lists only the backup namespace. The Google compatibility adapter keeps its existing one-request mixed `appDataFolder` listing behavior.
- Keep periodic checks visible-only. Sync mode checks every 5 minutes; hidden tabs, Manual mode, and Backup mode do not poll.
- Keep foreground sync cooldowns so focus/online events do not spam the Worker.
- Coalesce tab-visible and browser-online signals that arrive within one second into one eligibility check and at most one sync pass. Do not suppress a genuinely later online recovery event.
- Use Web Locks to avoid duplicate cross-tab sync.
- Retry genuine pending local work with bounded backoff when an active sync or Web Lock contention blocks an automatic upload. Do not retry clean checks or failed network/conflict passes in a loop.
- Use one merged delta per queued doc batch instead of uploading every Yjs update separately.
- Only run full-state upload when required: initial state, the exact disconnected dirty docs, legacy boolean-only dirty recovery, explicit verification, or compaction. A pull/consistency retry alone is not local dirty evidence.
- Page hide or exit during an active sync must not enqueue another forced sync; the active pass and durable recovery state already own the work.

Reliability can add checks, but heavy checks must stay off the normal no-change path.

Direct source keeps Google access tokens in one module-owned provider per tab. Tokens never enter React state/context, IndexedDB, local/session storage, Cache Storage, diagnostics, backup, or export. Cross-tab invalidation carries only a version and reason, and stale tabs may not delete a newer shared Worker session. Direct connections send normal Drive file bodies to Google rather than the Worker, and creates retain one pre-generated Drive ID for reconciliation.

The visible sync-status control remains navigable to Account > Cloud Sync during loading, connecting, checking, downloading, uploading, and syncing. That navigation must not start another sync pass.

## Merge And Validation Rules

- Yjs CRDT updates are the authority for normal concurrent edits/deletes.
- Remote updates should be rejected only if the binary update is corrupt.
- Reference-integrity validation warnings must not block CRDT convergence.
- Invalid entities should be filtered or normalized at read/import boundaries.
- Persisted-data normalization and cross-document reconciliation must be idempotent and emit no Yjs update once data is settled.
- Cross-document references can be temporarily incomplete while lazy docs load.
- A lazy document requested outside a sync waits for the active provider pass before doing provider or manifest work. A lazy document loaded from that pass's completion callback joins the pass and lets the owner commit the combined manifest, avoiding overlapping revision-sensitive writes.
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
- Local dirty/retry and disconnected-dirty evidence is scoped by durable provider ID plus connection generation. Existing generation-zero Google reads and mirrors `tasktime-sync-state` and `tasktime-disconnected-dirty-docs` so old tabs/builds retain recovery evidence; another provider or generation must never inherit or clear those legacy Google records.
- Dirty docs must be marked for full-state upload on reconnect.
- During a forced Sync Now pass, a full-state upload already required for exact dirty-document recovery also satisfies that document's verification requirement. Do not queue a second full-state write for the same document in the same pass.
- Failed pull/consistency work uses retry evidence separate from dirty-document evidence.
- Dirty markers may clear only after the active provider is not `offline` or `error` and reports no local changes left to push.
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
- The safe cloud-reset path is: export, Wipe data & disconnect, import while disconnected, reconnect, then verify sync completes.
- Import must route archived/historical entities to their correct docs.
- Imported disconnected docs must remain queued for full-state upload until Drive confirms no pending work remains.

## Wipe, Disconnect, And Delete-All

- Never auto-sync destructive resets across devices.
- Every connected provider presents exactly two session-lifecycle choices:
  **Disconnect** and **Wipe data & disconnect**. Provider-specific auth details
  are implementation concerns, not additional compact-menu choices.
- Provider transfer is an exceptional setup action in the overflow menu, named
  and marked for the destination provider rather than shown as a persistent
  settings card.
- The active-provider card pairs its title with the selected provider's official
  mark. Verified activation updates both through the durable lifecycle state.
  While transfer state is visible, its transient panel comes first. Progress
  stays at zero until the first durable journal stage, then advances by stage
  with a reduced-motion-safe traveling highlight inside the filled line.
  Successful completion removes the panel after the toast and active-provider
  switch take over.
- Transfer copy names the providers directly and avoids storage terminology.
  Its compact title-free warning says not to use TaskTime on other devices
  during transfer and to connect them to the new provider before editing.
- Reopening a retained transfer source stops at its verified move marker. The
  primary action connects the recorded destination without deleting source
  data. Sidebar and mobile sync status name the destination and open Cloud Sync
  choices rather than reconnecting the retained source directly. A secondary
  provider-marked action may reuse the source only after a
  destructive warning; it deletes and verifies all TaskTime source backups and
  sync files, removes the move marker last, leaves the destination untouched,
  and pushes the complete local workspace into the now-empty source.
- Sync & disconnect, Wipe & disconnect, and moved-source replacement use the
  shared disabled loading-button state with its spinner before the progress
  label for the full duration of each operation.
- Disconnect first completes a forced provider-neutral sync, then detaches this
  browser session without revoking the provider authorization. Provider sync
  files, backup snapshots, and local data remain in place.
- Wipe data & disconnect deletes and verifies all validated TaskTime sync files,
  deletes and verifies every TaskTime backup snapshot, confirms provider
  authorization revocation, and only then disconnects this browser. Local data
  remains on this device.
- Delete All Account Data while connected uses the same cloud ordering and then
  clears local data. If a lifecycle-selected provider cannot be reached, local
  deletion is blocked until that provider is reconnected so retained cloud data
  cannot silently reappear.
- A failure at any cloud deletion, backup deletion, or revocation step must stay
  visible and must not be reported as a completed wipe. Transient revocation
  failure preserves a retryable provider session and connected runtime.
- The low-level sync-file wipe primitive intentionally excludes backups so
  compaction and internal recovery cannot delete them accidentally; the
  user-facing wipe operation composes that primitive with verified backup
  deletion.
- Wipe is not a global tombstone. Another stale device can recreate cloud state
  after later authorization with old local data. Do not claim wipe makes old
  devices impossible to reintroduce without adding a reset-generation/tombstone
  protocol.

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
- Does the user-facing wipe delete and verify both sync files and backups before revocation, while ordinary sync cleanup still excludes backups?
- Does backup mode avoid pulling except on connect or Sync Now?
- Does manual mode remain user-controlled?
- Are stale Drive file IDs and trashed files handled?
- Are cross-tab and page-exit cases safe?

Recommended tests after changes:

- `make npm CMD="run test:run -- src/stores/yjs/YjsStore.test.js src/stores/yjs/providers/GoogleDriveProvider.test.js src/stores/yjs/providers/ManifestManager.test.js src/stores/yjs/validation.test.js src/stores/yjs/sampleBackupFixture.test.js src/components/sync/YjsSyncSettings.test.jsx src/components/sync/YjsSyncStatus.test.jsx src/components/sync/syncStatusDescriptor.test.js src/components/Account.test.jsx src/utils/syncPersistence.test.js"`
- `make build`
- `make lint`
