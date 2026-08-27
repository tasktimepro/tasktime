# Cloud Sync Provider Expansion

This is the public execution checklist for the planned provider-neutral cloud-sync and Dropbox phase. It complements `spec/roadmap.md`; private Worker contracts, capacity operations, provider-console setup, and deployment details remain in the private infrastructure plan.

The planned behavior contract is `spec/features/provider-neutral-cloud-sync-and-dropbox.md`.

## Current state

- [x] Audit the deployed direct Google Drive architecture, provider coupling, Worker boundary, Cloudflare capacity risk, privacy contract, tests, UI, deletion, backup, and agent consumers.
- [x] Confirm technical feasibility for a direct browser-to-Dropbox data path.
- [x] Approve the product/architecture decisions in `spec/ambiguities.md`.
- [x] Prepare the comprehensive one-phase private implementation plan.
- [x] Begin Slice 0 implementation prerequisites and contract labeling.
- [x] Complete Slice 1 Google Drive characterization and compatibility freeze.
- [x] Complete Slice 2 provider-neutral cloud file-store seam with Google behavior unchanged.
- [x] Complete Slice 3 provider-neutral sync/manifest/backup core and provider-scoped recovery persistence with Google behavior unchanged.
- [x] Complete the local Slice 4 Worker capacity/provider-session foundation with Dropbox disabled.
- [x] Implement the disabled local Dropbox OAuth/direct-file vertical through Slice 5.
- [x] Complete the disabled local provider lifecycle, Dropbox parity, verified transfer, product UI, destructive-flow, and agent work through Slice 9, including the shared two-choice Disconnect / Wipe data & disconnect lifecycle used by Cloud Sync, Account, and agent deletion.
- [x] Reconcile provider identity parity: active-provider hosted email/metrics/agent sessions, durable opaque identity linking, transfer fail-closed ordering, and former-provider local disconnect.
- [x] Configure the owner-only Dropbox development app, ignored local Worker credentials/salts/flags, production D1 resource/source binding, local hosted-identity schema, and Dropbox-enabled local app targets.
- [x] Reconcile the owner-only real-credential canary findings in code: tolerate Dropbox's optional response metadata, verify upload-session hashes per request body, serialize complete-backup lazy-document refreshes so revision-sensitive manifest writes cannot overlap, clear an exact lazy document's durable pending marker only after its data and manifest writes succeed, rehydrate exact pending lazy documents from local IndexedDB during the next forced sync after a refresh, reuse each required recovery full-state upload as that document's forced-verification write, and coalesce paired tab-visible/browser-online wake signals before provider work. Shared Google Drive and Dropbox regressions cover post-refresh recovery, pending-to-clear notification, one full-state write per recovery document per forced pass, and bounded Manual/Backup/Sync foreground behavior. The final owner Edge request-count rerun is also complete.
- [x] Reconcile the direct-Google reconnect regression found during local production-preview testing: successful non-manual reconnect now clears exact durable recovery identities only after document and manifest writes succeed, and exact dirty lazy documents are reloaded from IndexedDB and included in that reconnect instead of leaving unrelated loaded documents in a repeated full-state loop. The synthetic Drive canary survived disconnect/reconnect, Sync Now, and two consecutive clean reloads; both clean reloads reached In sync with no reconnect queue, recovery replay, full-state upload, or console error.
- [x] Complete the extended direct-Google production-preview regression with the deployed Google control plane and synthetic data: Backup mode pushed a local edit without pulling; Manual mode retained a pending edit across reload until explicit Sync Now; Sync mode checked the unchanged manifest and uploaded only the changed core delta; all three modes returned to In sync without console errors. A live backup was created, listed, and downloaded; a clean foreground wake inside the cooldown made zero provider requests; the stale clean wake made one manifest-metadata check with no document transfer or manifest save; and a second same-profile tab received a project-note update while both tabs remained green. The browser profile was left in the recommended Sync between devices mode.
- [x] Coalesce repeated same-scope connection renders while a provider connect is already in flight. A real deployed-Worker Google OAuth reconnect exposed five sequential full pulls for one user action; the shared lifecycle guard now keys the in-flight attempt by provider, generation, session, and transport, ignores stale completions, and has Google Drive and Dropbox regression coverage. The rebuilt production preview performed exactly one Drive connection start and completion, returned to In sync, and retained the synthetic canary project and cross-tab note.
- [x] Restore the owner Edge profile from the local Dropbox canary to the deployed Google control plane without wiping either provider. Google OAuth completed, the recommended Sync-between-devices transition ran one forced reconciliation pass, the following reload ran one connection pass, and the shared synthetic project note written during the Dropbox canary remained intact. The final Edge state is Google Drive, In sync, with no current console errors; the local Dropbox Worker is stopped.
- [x] Complete the owner Edge Dropbox parity and cleanup canary. Backup mode pushed one debounced project-note delta without pulling; Sync mode performed one unchanged-manifest check and one delta upload; a live backup was created, listed, downloaded, and structurally validated; a second same-profile tab received the canary note while both tabs stayed green; an offline edit remained local and automatically recovered on the later online event; and routine file operations made zero Worker requests. Wipe data & disconnect deleted all managed files, revoked the Dropbox session, left both App Folder namespaces at zero items, and retained all eight local projects. The final deployed-control-plane Google reconnect completed one reconciliation pass and retained the complete canary note in an In sync state.
- [x] Serialize externally requested lazy-document sync behind an active provider pass, while allowing callback-owned lazy loads to join that pass and defer their manifest commit to its owner. This prevents revision-sensitive manifest writes from racing during navigation/archive loading without changing Google or Dropbox file contracts; focused regression coverage proves both paths.
- [x] Pass the reconciled local gates: app lint, typecheck, production app/blog build, 239 test files / 2,215 tests with coverage (93.12% statements / 82.67% branches / 94.27% functions / 94.19% lines overall), 38/38 Chromium smoke tests, 2/2 PWA smoke tests, direct Google transport in Chromium/Firefox/WebKit, private Worker typecheck and 13 files / 105 tests, plus bridge/OpenClaw package dry-runs and packaged bridge, managed-bundle, and live MCP smoke tests.
- [x] Refine the disabled transfer UI with a lifecycle-selected provider mark and title, an above-settings transient transfer panel, and accessible determinate progress driven by durable journal stages.
- [x] Keep transfer progress at zero until the first durable stage, animate a reduced-motion-safe traveling highlight inside the filled line while work is ongoing, and remove the transient panel after successful completion.
- [x] Clarify cross-device transfer guidance with provider-specific plain language: other devices remain authorized, TaskTime stays closed there during transfer, and those devices connect to the new provider before editing.
- [ ] Deploy or enable any Dropbox runtime behavior.

The current production contract remains Google Drive only. Do not mark Dropbox available in requirements, contracts, architecture summaries, privacy/terms, README, or public copy before the implementation and rollout state makes that claim true.

The owner-only Dropbox development app and local Worker configuration have now
completed the initial real-credential Manual-mode canary. OAuth, direct App
Folder access, initial sync, post-refresh recovery, and an explicit Sync Now
reached a clean green state. That run exposed duplicate full-state writes for
exact recovery documents during forced verification; the shared core now reuses
the recovery write and has Google Drive/Dropbox regression coverage. Reopening
a retained development tab while both local servers were stopped also exposed
paired visibility/online retries; those wake signals now coalesce for one
second while a genuinely later online event can still recover. The post-fix
owner Edge rerun then proved one Dropbox connection pass, a Manual-mode reload
with one status check and one access-token issuance, a local project-note edit
with no automatic Worker request, and one explicit forced sync covering each of
the four loaded documents exactly once. That sync made zero Worker requests;
the file reads, manifest operations, and full-state writes went directly from
the browser to Dropbox. A second Manual-mode reload performed one connection
pass without a sync/push/pull pass, retained the synthetic project note, and
returned to In sync. Dropbox's expected `path/not_found` 409 responses during
first-time namespace/file discovery remained handled control flow rather than
sync failures. The extended parity run then covered Backup and Sync modes,
backup creation/list/download, two-tab convergence, offline/online recovery,
and verified wipe/revoke cleanup. Routine Dropbox file operations remained
browser-to-Dropbox, the local Worker observed only control-plane calls, both
App Folder namespaces ended empty after wipe, and the local workspace remained
intact before the profile returned to a green Google Drive connection. The
production hosted-identity
D1 resource exists and its binding is prepared in source, but the remote
migration, production Worker secrets/deployment, supported-browser canaries,
and public enablement remain open. All tracked production Dropbox controls
remain off. A live two-provider transfer is also setup-blocked rather than
code-blocked: the local Worker still has the placeholder Google OAuth client,
while the deployed Worker correctly keeps Dropbox connection and transfer
controls disabled.

## Fixed outcomes

- One active cloud provider per browser profile; no automatic Google/Dropbox mirroring.
- Explicit, journaled, readback-verified transfer in either direction.
- Complete live workspace and one target handoff backup; source files and historical backup archives retained by default.
- Manual, Backup, and Sync mode parity on both providers.
- Routine file bodies directly browser-to-provider; Worker control plane only.
- Dropbox App Folder and least-privilege file scopes.
- Memory-only browser access tokens and encrypted Worker refresh credentials.
- The active provider is the storage and TaskTime hosted-service identity; no
  parallel Google session is required for Dropbox.
- Provider subjects are hashed and linked to one opaque hosted principal only
  during an explicit two-session transfer; legacy Google email/metrics keys and
  quota aliases remain compatible.
- Google files, manifests, sessions, modes, lock coordination, UI APIs, and Drive agent commands remain compatible.
- Cloudflare limiter/session capacity hardened and measured before public rollout.

## Dependency-ordered slices

### Slice 0 — Contract lock, baseline, and provider setup

- [x] Label planned versus currently deployed behavior across source-of-truth documents.
- [x] Register the private Dropbox App Folder development app with exact redirect URIs and minimum scopes for owner-only development testing.
- [x] Prepare the private App Console configuration packet without storing an app key or secret.
- [x] Define independent fail-closed endpoint, new-connection, and transfer rollout controls; all ship disabled.
- [x] Capture current Google request counts and the 30-day Worker/KV/D1 capacity baseline.

### Slice 1 — Google Drive characterization freeze

- [x] Lock current manifest/file/session compatibility, mode matrix, request budgets, dirty recovery, lock name, backups, auth, revoke/disconnect, offline, and cache behavior in tests.
- [x] Add supported historical Google manifest and legacy Worker-session fixtures.

### Slice 2 — Cloud file-store seam with Google unchanged

- [x] Add the provider-neutral file contract and normalized errors.
- [x] Route current Google operations through `GoogleDriveFileStore` while retaining existing imports/facades and request counts.

### Slice 3 — Provider-neutral sync and backup core

- [x] Extract shared manifest/Yjs/backup behavior without changing Google semantics.
- [x] Namespace dirty/recovery state by provider/generation and migrate legacy Google evidence conservatively.
- [x] Keep `tasktime-drive-sync` as the compatibility Web Lock name.

### Slice 4 — Worker capacity and provider-session foundation

- [x] Replace KV-backed auth/token/push abuse counters with Workers Rate Limiting bindings in the private Worker source.
- [x] Add provider-discriminated sessions with missing provider treated as legacy Google.
- [x] Prove doubled projected peak headroom against the captured baseline; no D1 session branch is currently required.
- [ ] Deploy the compatible foundation with Dropbox disabled.

### Slice 5 — Dropbox OAuth and direct file-store vertical

- [x] Add disabled, additive Dropbox OAuth/status/token/revoke endpoints and reject any Dropbox file proxy route.
- [x] Add memory-only browser token handling, provider-specific callback/invalidation, and the direct Dropbox App Folder adapter.
- [x] Cover revision conflicts, hashes, pagination, ambiguous writes, rate limits, capacity errors, and large upload sessions with simulated provider contracts.
- [x] Complete the owner-only Microsoft Edge real-credential synthetic App Folder and post-fix request-count canary using the prepared local setup.
- [ ] Complete the production supported-browser credential and network canaries after the disabled Worker foundation is deployed.

### Slice 6 — Provider-aware client lifecycle

- [x] Add one-active-provider state, generation fencing, staged target ownership, and cross-tab invalidation.
- [x] Bind hosted-service identity to the active storage session while preserving
  the legacy `driveSessionId` compatibility field for old Google consumers.

### Slice 7 — Hidden Dropbox sync and backup parity

- [x] Pass the shared Manual/Backup/Sync, offline/reconnect, lazy-document, compaction, full-state, backup/restore/retention, wipe, and request-count contracts through the pre-release Dropbox path and simulated provider contracts.
- [x] Keep Google suites and request counts unchanged.

### Slice 8 — Durable verified provider transfer

- [x] Add the non-Yjs transfer journal, workspace lineage marker, source recheck, target readback/state-vector verification, crash resume, and final activation.
- [x] Pass both directions through the shared coordinator, including same-lineage targets, foreign-target refusal, source changes, lazy history, verification failure, lock contention, and activation crash recovery without deleting the source.
- [x] Bind Dropbox OAuth to a signed transfer purpose and recheck the live Worker transfer control before either direction begins provider data work.
- [x] Link the authenticated source/target hosted identities after target
  readback verification and before the source move marker; fail closed when the
  identity store is unavailable.
- [x] Locally disconnect the former provider after activation while retaining
  source files and keeping grant revocation/deletion explicit.
- [x] Explain and test the current-profile guarantee and the offline/legacy-device limitation.

### Slice 9 — Product, destructive-flow, and agent parity

- [x] Add accessible provider choice, status, transfer progress/recovery, a destination-marked transfer action in the overflow menu, and the same two connected-provider lifecycle actions: Disconnect, plus a trash-icon Wipe data & disconnect action that deletes sync files and backups before revocation. Dropbox entry points now default on for the next release, with only an explicit false emergency UI opt-out.
- [x] Generalize cloud backup/status agent commands while preserving Drive-named commands as Google-only.
- [x] Route browser and agent hosted email plus synced metrics through the active
  provider session; preserve legacy Google behavior and prove Dropbox-only
  hosted-service calls without a Google session.
- [x] Rebuild only agent artifacts whose shipped command/catalog contents change; leave them uncommitted and unpublished.

### Slice 10 — Privacy reconciliation, canary, and rollout

- [x] Reconcile the approved planned contract, internal implementation docs,
  architecture/rules, sync docs, environment setup, and status while retaining
  truthful Google-only current-production claims.
- [x] Create the hosted-identity D1 resource, prepare its source binding and
  dedicated ignored local salt, and apply the migration to local Wrangler D1.
- [ ] Apply the hosted-identity migration remotely, configure its production
  salt, then deploy the compatible Worker with all Dropbox controls false.
- [x] Prepare next-release public contracts, privacy/terms, README, onboarding,
  agent guidance, and evergreen public copy for Google Drive/Dropbox parity.
  These changes remain unshipped and must not be described as deployed until
  the compatible Worker/app production canary is green.
- [ ] Complete Dropbox production approval and supported-browser credential canaries with synthetic data.
- [x] Prove in the owner-only Edge canary that no Worker request carries routine Dropbox provider data.
- [ ] Repeat the direct-data-path proof in the production supported-browser canaries.
- [x] Pass the local private Worker gates, full public app release gate,
  packaged-agent smokes, and cross-browser direct-Google regression.
- [ ] Enable bounded new connections before transfers, compare capacity/errors to budgets, and retain tested rollback controls.

## Required release evidence

- Existing Google users upgrade without reset, reconnect, manifest rewrite, or changed sync semantics.
- Both providers pass the shared adapter, mode, request-budget, backup, destructive-action, and privacy matrices.
- Both transfer directions reconstruct the same complete Yjs workspace and recover safely from every injected interruption.
- Worker tests/typecheck, app coverage/lint/typecheck/build/browser/PWA/release gates, and generated agent checks are green as applicable.
- Dropbox App Folder scopes, redirect URIs, production approval, and privacy disclosures are verified.
- Total Cloudflare usage retains at least two-times headroom under the selected plan after a doubled peak projection and canary comparison.
- Existing Dropbox support survives acquisition/transfer rollback; no automatic Google fallback exists.
- Exact releases/deployments and public enablement receive separate explicit approval.
