# Sync, Backup, And Import

## Behavior

- IndexedDB persists every managed Yjs document locally.
- Cloud sync exchanges deltas/manifests directly with the selected Google Drive or Dropbox provider using a short-lived memory-only access token. It uses metadata checks, throttling, and cross-tab locking.
- Manual, backup, and sync modes follow the trigger matrix in `AGENTS.md`.
- In automatic modes, rich project-note edits wait for a 1.5-second quiet period and then use the ordinary mode-specific sync pipeline. Manual mode keeps notes local until an explicit sync.
- Sync mode checks the manifest every five minutes while the app is visible; hidden tabs do not run periodic provider checks. Focus and online cooldowns remain separate.
- Automatic uploads that encounter an active sync or occupied cross-tab lock retry only while genuine local work remains pending, using bounded backoff after the lock can be released.
- Initial connection captures local edits before provider I/O and defers automatic
  uploads until setup finishes. Documents opened during setup join the pass;
  Manual bootstrap remains pull-only even with concurrent edits.
- Remote integrity diagnostics run after complete successful passes and defer
  task/invoice references until their remote archives are available. Corrupt
  binaries still fail immediately; unresolved references retain their records.
- Dirty documents changed while disconnected are recorded for full-state upload on reconnect.
- Export produces a portable data backup; import validates and previews before restore. A completed restore closes the import dialog and confirms success with a toast.

## Edge cases

- Pristine-device bootstrap, stale remote manifests, missing remote files, partial uploads/downloads, reconnect, concurrent tabs, historical document names/shapes, and destructive reset propagation.
- Credentials and Worker session data are not part of backups.

## Evidence

Provider/manifest/store validation tests, import/export integration tests, backup fixtures, offline/sync Playwright tests, and account agent backup commands.
