# Sync, Backup, And Import

## Behavior

- IndexedDB persists every managed Yjs document locally.
- Drive sync exchanges deltas/manifests through the configured Worker and uses metadata checks, throttling, and cross-tab locking.
- Manual, backup, and sync modes follow the trigger matrix in `AGENTS.md`.
- Dirty documents changed while disconnected are recorded for full-state upload on reconnect.
- Export produces a portable data backup; import validates and previews before restore.

## Edge cases

- Pristine-device bootstrap, stale remote manifests, missing remote files, partial uploads/downloads, reconnect, concurrent tabs, historical document names/shapes, and destructive reset propagation.
- Credentials and Worker session data are not part of backups.

## Evidence

Provider/manifest/store validation tests, import/export integration tests, backup fixtures, offline/sync Playwright tests, and account agent backup commands.
