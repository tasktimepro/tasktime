# Cloud Sync Provider Expansion

This is the public execution checklist for the planned provider-neutral cloud-sync and Dropbox phase. It complements `spec/roadmap.md`; private Worker contracts, capacity operations, provider-console setup, and deployment details remain in the private infrastructure plan.

## Current state

- [x] Audit the deployed direct Google Drive architecture, provider coupling, Worker boundary, Cloudflare capacity risk, privacy contract, tests, UI, deletion, backup, and agent consumers.
- [x] Confirm technical feasibility for a direct browser-to-Dropbox data path.
- [x] Approve the product/architecture decisions in `spec/ambiguities.md`.
- [x] Prepare the comprehensive one-phase private implementation plan.
- [ ] Begin Slice 0 implementation prerequisites and contract labeling.
- [ ] Implement or deploy any Dropbox runtime behavior.

The current production contract remains Google Drive only. Do not mark Dropbox available in requirements, contracts, architecture summaries, privacy/terms, README, or public copy before the implementation and rollout state makes that claim true.

## Fixed outcomes

- One active cloud provider per browser profile; no automatic Google/Dropbox mirroring.
- Explicit, journaled, readback-verified transfer in either direction.
- Complete live workspace and one target handoff backup; source files and historical backup archives retained by default.
- Manual, Backup, and Sync mode parity on both providers.
- Routine file bodies directly browser-to-provider; Worker control plane only.
- Dropbox App Folder and least-privilege file scopes.
- Memory-only browser access tokens and encrypted Worker refresh credentials.
- Storage identity separated from billing/hosted-email/product identity.
- Google files, manifests, sessions, modes, lock coordination, UI APIs, and Drive agent commands remain compatible.
- Cloudflare limiter/session capacity hardened and measured before public rollout.

## Dependency-ordered slices

### Slice 0 — Contract lock, baseline, and provider setup

- [ ] Label planned versus currently deployed behavior across source-of-truth documents.
- [ ] Register the private Dropbox App Folder development app with exact redirect URIs and minimum scopes.
- [ ] Define independent endpoint, new-connection, and transfer rollout controls.
- [ ] Capture current Google request counts and total Worker/KV/D1 capacity baseline.

### Slice 1 — Google Drive characterization freeze

- [ ] Lock current manifest/file/session compatibility, mode matrix, request budgets, dirty recovery, lock name, backups, auth, revoke/disconnect, offline, and cache behavior in tests.
- [ ] Add supported historical Google manifest and legacy Worker-session fixtures.

### Slice 2 — Cloud file-store seam with Google unchanged

- [ ] Add the provider-neutral file contract and normalized errors.
- [ ] Route current Google operations through `GoogleDriveFileStore` while retaining existing imports/facades and request counts.

### Slice 3 — Provider-neutral sync and backup core

- [ ] Extract shared manifest/Yjs/backup behavior without changing Google semantics.
- [ ] Namespace dirty/recovery state by provider/generation and migrate legacy Google evidence conservatively.
- [ ] Keep `tasktime-drive-sync` as the compatibility Web Lock name.

### Slice 4 — Worker capacity and provider-session foundation

- [ ] Replace KV-backed auth/token/push abuse counters with Workers Rate Limiting bindings.
- [ ] Add provider-discriminated sessions with missing provider treated as legacy Google.
- [ ] Prove doubled projected peak headroom or complete the selected paid-KV/D1 prerequisite.
- [ ] Deploy the compatible foundation with Dropbox disabled.

### Slice 5 — Dropbox OAuth and direct file-store vertical

- [ ] Add disabled, additive Dropbox OAuth/status/token/revoke endpoints and reject any Dropbox file proxy route.
- [ ] Add memory-only browser token handling, provider-specific callback/invalidation, and the direct Dropbox App Folder adapter.
- [ ] Cover revision conflicts, hashes, pagination, ambiguous writes, rate limits, capacity errors, and large upload sessions.

### Slice 6 — Provider-aware client lifecycle

- [ ] Add one-active-provider state, generation fencing, staged target ownership, and cross-tab invalidation.
- [ ] Separate active storage session from hosted-service identity while preserving legacy Google fields/consumers.

### Slice 7 — Hidden Dropbox sync and backup parity

- [ ] Pass the shared Manual/Backup/Sync, offline/reconnect, lazy-document, compaction, full-state, backup/restore/retention, wipe, and request-count contracts through Dropbox.
- [ ] Keep Google suites and request counts unchanged.

### Slice 8 — Durable verified provider transfer

- [ ] Add the non-Yjs transfer journal, workspace lineage marker, source recheck, target readback/state-vector verification, crash resume, and final activation.
- [ ] Pass both directions, same-lineage return, foreign-target refusal, local/remote concurrency, lazy history, and every failure stage without changing/deleting the source.
- [ ] Explain and test the current-profile guarantee and the offline/legacy-device limitation.

### Slice 9 — Product, destructive-flow, and agent parity

- [ ] Add accessible provider choice, status, transfer progress/recovery, and accurate disconnect/revoke/delete actions.
- [ ] Generalize cloud backup/status agent commands while preserving Drive-named commands as Google-only.
- [ ] Rebuild only agent artifacts whose shipped command/catalog contents change.

### Slice 10 — Privacy reconciliation, canary, and rollout

- [ ] Reconcile requirements, acceptance, contracts, rules, architecture, sync docs, privacy/terms, public copy, environment docs, runbooks, and status with actual behavior.
- [ ] Complete Dropbox production approval and supported-browser credential canaries with synthetic data.
- [ ] Prove through network inspection that no Worker request carries routine provider data.
- [ ] Pass private Worker gates and the full public app release gate.
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
