# Data Protection And Sync Experience Design

## Goal

Make backup, import, Drive connection, and sync-mode consequences understandable without requiring knowledge of CRDT internals.

- Account settings explain local-first ownership and that cloud connection is optional.
- Manual, backup, and sync modes state whether automatic triggers pull, push, or do neither.
- “Sync Now” remains an explicit full reconciliation action in all modes.
- A pristine first-device Manual connection may perform its one bootstrap pull but performs no Drive write; recovered manifest housekeeping waits for an explicit sync.
- A clean foreground event inside the cooldown makes no Worker/Drive request. After the cooldown, an unchanged cloud state costs one lightweight manifest-metadata check and no document transfer or manifest write; that successful no-op check starts the next cooldown.
- Status distinguishes connecting, checking, downloading, uploading, offline, idle, and error phases.
- Sync success waits for required archive/billing reconciliation and flushes any deltas that reconciliation creates. A pull or consistency failure remains visible and leaves durable retry evidence across reload/reconnect.
- Local dirty recovery retains exact document identity. Pull-only failures do not turn clean documents into full-state uploads, and hiding the page during an active pass does not enqueue another forced pass.
- On-demand document loading serializes with an active provider pass. Callback-owned lazy loads join that pass and defer the combined manifest save to its owner, so navigation cannot race a second manifest write against the current sync.
- Archive and persisted-record reconciliation is idempotent so a settled workspace does not create another local change and sync loop.
- Backup import uses preview/validation before applying data.
- A replacement restore journals the complete previous workspace and active
  timers in a separate IndexedDB database before deletion. The journal remains
  until every replacement document passes a persistence barrier; startup
  automatically recovers the previous workspace if the browser stopped first.
- A connected provider offers two compact, provider-independent lifecycle
  actions: Disconnect, and a trash-icon Wipe data & disconnect action. The
  latter removes all TaskTime cloud sync files and backups and revokes provider
  access; Account-wide deletion reuses that cloud operation before clearing
  local data.
- The exceptional provider-transfer action lives in the same overflow menu
  rather than a persistent settings section. Its label and official mark name
  the destination provider.
- The active-provider heading pairs the provider name with its official mark and
  follows the lifecycle-selected provider after verified transfer activation.
  A transient transfer panel is the first settings card while present and uses
  durable journal stages for accessible determinate progress.
- The edge service retains OAuth code exchange, encrypted refresh-token storage, access-token issuance, and revocation. Normal Drive file requests go directly to Google using an active-tab-memory token. The UI must not imply that sync creates a TaskTime-hosted workspace copy.

Errors provide recovery steps without suggesting browser/Drive resets as a routine fix.
