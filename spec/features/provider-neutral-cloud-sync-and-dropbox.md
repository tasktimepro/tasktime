# Provider-Neutral Cloud Sync And Dropbox

> **State:** Next-release behavior; implementation, internal documentation, local automated validation, the owner-only development app/setup, the complete local Microsoft Edge real-credential canary, and next-release public/legal copy are complete through the local portion of Slice 10. The client now enables Dropbox entry points by default, with an explicit false emergency opt-out. Production configuration/deployment, production supported-browser canaries, and live enablement remain deferred
>
> **Current production behavior:** Google Drive only

This specification locks the approved product behavior for adding Dropbox in
the next release. The deployed production service remains Google Drive-only
until the compatible Worker and client release are promoted together.

## User outcome

- A browser profile has one active cloud-sync provider: Google Drive or Dropbox.
- The active provider supports the existing Manual, Backup, and Sync modes with
  the same triggers, cooldowns, dirty recovery, cross-tab serialization, and
  full-state verification.
- A user can explicitly transfer a complete live workspace from either provider
  to the other and begin using the verified target.
- Because transfer is an exceptional setup action, the connected-provider
  overflow menu labels it with the destination provider name and official mark;
  it does not occupy a persistent settings card.
- The active-provider card displays that provider's official mark beside its
  title. After verified target activation, both the title and mark switch to the
  new active provider from the durable lifecycle state.
- While a transfer is authorizing, running, recoverable, or failed, its
  transient panel appears above the active-provider settings. Progress remains
  at zero until the first durable transfer stage, then advances monotonically
  by stage; a reduced-motion-safe traveling highlight inside the filled line
  distinguishes ongoing work. After success, the toast and switched provider
  card take over and the transient panel is removed.
- Transfer guidance uses provider names and plain language. A compact,
  title-free warning tells users not to use TaskTime on other devices during
  transfer and to connect those devices to the new provider before editing.
- The selected provider session is also the authentication boundary for
  TaskTime-hosted email, privacy-safe synced metrics, and future Pro
  trial/subscription entitlements. Dropbox users do not need Google.
- Transfer retains source sync files and historical source backups by default.
  It remains separate from the two active-provider lifecycle choices, which
  stay identical for Google Drive and Dropbox: Disconnect, or Wipe data &
  disconnect.
- Existing Google users upgrade without clearing browser data, reconnecting,
  rewriting manifests, or changing their current sync behavior.

## Provider and data-plane boundary

- Provider identifiers are durable: `google-drive` and `dropbox`.
- Dropbox uses App Folder access with only `files.metadata.read`,
  `files.metadata.write`, `files.content.read`, and `files.content.write`.
- Routine manifests, Yjs states/deltas, backup snapshots, restores, wipes, and
  transfer bodies travel directly between the browser and the selected provider.
- The Worker is an OAuth/session/token/revocation control plane. It must not
  receive, proxy, log, persist, or inspect routine provider file bodies.
- Dropbox support must not add a Worker file-proxy route or fall back to one after
  a direct-provider request fails.

## Credential and identity boundary

- Refresh credentials are application-encrypted in private Worker storage and
  never returned to the browser.
- A short-lived access token may exist only in one module-owned memory instance
  per active tab. It is excluded from React state, Yjs, IndexedDB, local or
  session storage, Cache Storage, backups, exports, logs, and diagnostics.
- The active storage session is the active TaskTime hosted-service session.
  Google and Dropbox authorize the same TaskTime feature set; provider-specific
  API limits or outages may differ, but TaskTime does not give one provider a
  larger product capability set.
- The Worker derives a domain-separated subject hash from the provider account
  subject. Dropbox stores only a TaskTime-scoped account pseudonym and exact
  granted file scopes; it does not request or retain Dropbox email/profile data.
- A durable opaque hosted principal links provider subjects only during an
  explicit transfer authenticated with both provider sessions. This principal,
  not a raw Google/Dropbox identifier, is the future billing/trial subject.
- Existing Google email and metrics hashes remain byte-for-byte compatible.
  Provider transfer retains legacy quota aliases so switching cannot reset or
  duplicate an allowance.
- TaskTime-hosted email continues to use the configured delivery adapter; the
  selected cloud provider authenticates the request but is not the mail carrier.
- The privacy claim is a server-blind routine data plane, not cryptographic zero
  knowledge: the selected provider stores the files, and the Worker can issue a
  token from its encrypted refresh credential.

## Active-provider and transfer rules

- Only the active provider may perform automatic sync. A second provider session
  may exist only as transfer-coordinator-owned staged state.
- Transfer is journaled outside Yjs and resumable after refresh, tab closure,
  network failure, or provider error.
- Before target activation, transfer must materialize the complete source,
  upload every managed document, commit the target manifest last, read back and
  verify target bytes/state vectors, recheck that the source did not change
  unnoticed, and atomically link hosted-service ownership. Identity-link failure
  keeps the source active and the transfer resumable.
- A target must be empty or carry the same TaskTime workspace lineage. Foreign,
  unknown, or orphaned TaskTime data is never silently overwritten or merged.
- Any failure before commit keeps the source active and preserves all local dirty
  evidence. No automatic source deletion occurs after commit.
- Successful activation locally disconnects the former provider so storage,
  hosted email, metrics, and future Pro state all use the target. Revoking the
  former provider grant and deleting its retained files remain separate actions.
- For the currently active provider, Disconnect performs a final sync and
  detaches only this browser while retaining authorization and provider data.
  Wipe data & disconnect verifies removal of all TaskTime sync files and backup
  snapshots, confirms authorization revocation, and then disconnects while
  retaining local data. Account-wide deletion performs that cloud sequence
  before clearing local data.
- The target receives the live workspace and one verified handoff backup;
  historical backup archives are not bulk-copied in this phase.
- The app strictly coordinates the current browser profile and its active tabs.
  It cannot atomically stop an offline device or legacy cached PWA. Updated
  clients honor a source migration marker. Other devices may remain authorized,
  but TaskTime should stay closed on them during transfer and reconnect to the
  new provider before editing; provider-grant revocation remains the dependable
  way to stop a legacy client.

## Request and capacity contract

- A warm token and a clean foreground event inside the cooldown make zero Worker
  and provider requests.
- A stale clean check with a warm token performs at most one direct provider
  manifest-metadata request and no file transfer, manifest save, backup listing,
  or full namespace listing.
- Tab-visible and browser-online signals within the same one-second wake window
  coalesce into one eligibility check and at most one provider sync pass. A
  later online transition remains eligible to recover a failed/offline pass.
- Routine Worker request count is independent of workspace bytes and document
  count.
- KV-backed request counters are replaced with Workers Rate Limiting bindings
  before Dropbox exposure. Those permissive, location-local counters are abuse
  controls, not exact billing or entitlement accounting.
- Public rollout requires a measured baseline, doubled projected peak, and at
  least two-times capacity headroom for Worker requests and retained KV/D1 use.
  Session storage moves to a compatible paid-KV or D1 design before rollout if
  that gate is not met.

## Rollout and rollback

- Worker endpoint support, new Dropbox connections, and transfers retain
  separate fail-closed controls.
- Release order is the compatible Worker foundation and production
  configuration first, followed by one Dropbox-enabled app deployment. With
  only the two known production users, no separate hidden-client or bounded
  connection phase is required.
- Rollback may stop new connections or transfers. Once a user has active Dropbox
  data, rollback must retain existing Dropbox read/write support and must never
  silently select Google.
- Dropbox may be prepared in next-release source and copy, but it must not be
  claimed as deployed until the compatible Worker and app are live and the
  production canary is green.

## Required evidence

- Existing Google characterization and request-count suites stay green through
  every extraction slice.
- Both providers pass the same file-store, mode, request-budget, backup,
  destructive-action, offline/reconnect, and privacy tests.
- Both providers pass the same hosted-email, metrics-subject, agent-email, and
  future-entitlement identity contracts without requiring the other provider.
- Both transfer directions pass full-workspace verification and injected failure
  recovery at every journal stage, including hosted-identity linking and former
  local-session cleanup.
- Network inspection proves that no routine provider body reaches the Worker.
- Dropbox redirect URIs, App Folder access, exact scopes, branding, production
  approval, supported-browser credential canaries, Cloudflare capacity, and
  rollback behavior are verified before public enablement.

See `spec/ambiguities.md` for the approved decisions and
`status/cloud-sync-provider-expansion.md` for dependency-ordered execution.
