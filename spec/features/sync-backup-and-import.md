# Sync, Backup, And Import

## Behavior

- IndexedDB persists every managed Yjs document locally.
- Drive sync exchanges deltas/manifests directly with Google Drive using a short-lived memory-only access token. It uses metadata checks, throttling, and cross-tab locking.
- Manual, backup, and sync modes follow the trigger matrix in `AGENTS.md`.
- In automatic modes, rich project-note edits wait for a 1.5-second quiet period and then use the ordinary mode-specific sync pipeline. Manual mode keeps notes local until an explicit sync.
- Sync mode checks the manifest every five minutes while the app is visible; hidden tabs do not run periodic Drive checks. Focus and online cooldowns remain separate.
- Automatic uploads that encounter an active sync or occupied cross-tab lock retry only while genuine local work remains pending, using bounded backoff after the lock can be released.
- Dirty documents changed while disconnected are recorded for full-state upload on reconnect.
- Export produces a portable data backup; import validates and previews before restore.

## Edge cases

- Pristine-device bootstrap, stale remote manifests, missing remote files, partial uploads/downloads, reconnect, concurrent tabs, historical document names/shapes, and destructive reset propagation.
- Credentials and Worker session data are not part of backups.

## Evidence

Provider/manifest/store validation tests, import/export integration tests, backup fixtures, offline/sync Playwright tests, and account agent backup commands.
