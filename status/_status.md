# Delivery Status — Overview

This coordinator tracks active execution. Detailed work lives in `app-status.md`, `agent-status.md`, and `site-status.md`. `TODO.md` remains the broader backlog and ideas list.

## Overall state

TaskTime Pro is in production. The core local-first app, Drive sync, invoicing/reporting, public site, and local agent bridge are implemented. Current work focuses on assurance, compatibility, TypeScript migration, and publishing/validation follow-through rather than greenfield delivery.

## Current phase

**Program Phase 2 app-origin migration preparation complete locally**

- Direct browser-to-Google Drive sync is deployed. The active Worker retains only OAuth/token control-plane duties, rejects the retired `/drive/*` route without CORS permission, and permits the exact `http://localhost:3101` production-equivalent preview origin. The temporary staging resources, local secrets/configuration, tests, and runbook have been removed. Privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy state the direct browser-to-Google Drive boundary.
- Offline lazy-document navigation now short-circuits before any remote Drive work and subscribes locally; a red/green provider regression covers the cached-manifest case that previously produced failed offline requests. Focused provider tests, app typecheck, lint, and diff checks are green.
- Direct Drive auto-sync now batches project-note typing after a 1.5-second quiet period, retries genuine pending work after active-sync/Web Lock contention with bounded backoff, and checks for remote changes every five minutes only while Sync mode is visible.
- The browser retest confirms offline navigation now produces neither Drive requests nor upload errors.
- Provider-neutral cloud sync is deployed with direct Google Drive and Dropbox data planes, active-provider hosted identity, and explicit user-initiated transfer in either direction. The moved-source recovery is provider-symmetric: it offers the recorded destination first and permits source reuse only after verified source-only deletion and a complete local push-only seed, without touching the recorded destination.
- Core app `1.5.0` passed GitHub CI and serves the Dropbox announcement, RSS entry, and sitemap route. The existing production Google Drive session survived the upgrade and returned to In sync after an explicit Sync Now with no new app, Yjs, or sync errors. The compatible Worker passed typecheck and its complete focused test suite, enables transfers, and returned a valid provider-specific transfer authorization URL without starting an automatic move. The full real-account transfer and moved-source replacement journeys remain proven by local production-preview canaries.
- Gradual TypeScript and testing-infrastructure improvements
- Installed OpenClaw validation and remaining agent-directory publication checks
- Program Phase 2 has been narrowed to a supervised two-user cutover. There is
  no general-purpose migration protocol or permanent migration UI: each user
  reconnects the same provider on the pristine new origin, with the existing
  complete validated backup/import as fallback, and keeps the old origin intact
  until verification. Exact app/marketing/Worker/agent origin handling and
  isolated `dist-app`/`dist-site` outputs are prepared locally. Focused app and
  provider tests, lint, typecheck, the real 50-page production build, agent
  bundle smokes, and the complete Worker test/typecheck gate pass. The private
  supervised cutover/rollback checklist covers PWA, Push, email, billing,
  metrics, agent re-pairing, the minimal two-Pages-project/one-Worker topology,
  an immutable root rollback artifact, single deployment authority per project,
  and a post-window inventory/cleanup gate. No live domain, configuration,
  deployment, or user-data action occurred.
- OpenClaw durability implementation and automated release evidence are complete: credentials/contracts are reconciled, status/logging are hardened, browser refresh and same-profile reopen continuity are covered, and the native plugin owns one Gateway-lifecycle bridge while generic MCP/Claude stdio remain supported. CLI/Gateway alignment and disposable-profile migration/rollback now pass on `2026.7.1-2`; the final installed plugin/browser multi-turn acceptance remains pending.
- Approved product backlog after its recorded ambiguities are resolved
- The subscription/license implementation is present locally across Worker/D1,
  signed status/license, shadow billing UI, active-client transitions, the Free
  Reports Overview/static Pro boundary, hosted-email quota/status recovery, and
  browser/agent policy. Fresh real-local D1 execution covers ordered migrations,
  one-time trial contention, 251-way founding capacity, atomic email quota,
  one-sided and compatible same-Stripe-owner provider transfers, conflicting
  dual ownership, fresh-account transfers in both directions, target-side
  mutation races, cross-D1 recovery, and alternate-binding restore. The private
  Worker gate passes 33 files / 307 tests plus typecheck and both migration/schema
  verifiers; the public release gate passes 259 files / 2,437 tests, coverage
  thresholds, 39 Chromium smokes, four PWA smokes, and the 50-page merged build;
  changed agent artifacts pass their
  local release smoke. The bounded main-account Stripe test-mode rehearsal now
  passes founding/standard Checkout, Portal, webhook ordering, renewal and
  failure recovery, pause, matched dispute, cancellation, reconciliation, and
  synthetic-object cleanup. All production controls remain false and no remote
  migration, live Stripe mutation, deployment, paid-copy publication, or
  production canary is part of this local phase. The
  approved boundary is Free with one active client and a current-local-month
  Reports Overview, Pro with unlimited active clients, advanced Reports/exports
  and hosted sending, and a `EUR 39/year` founding offer for the first 250 paid
  canonical principals followed automatically by the `EUR 59/year` standard
  offer for new purchases. Email allowance, paid grace, tax-inclusive versus
  additional-tax presentation, both live Stripe mappings, remaining payment/
  refund/Portal/support policy, Dropbox broad-public access, the
  app-origin migration, homepage work, and live release approval remain gates.
  Local green evidence is not release approval. The Phase 1 code candidate is
  complete.
  The synthetic billing-state preview has been retired in favor of a guarded
  loopback-development pre-production sandbox. It runs the normal app against
  local Worker/D1 and real Stripe test-mode Checkout/webhooks. Hosted email now
  uses the normal Pro entitlement, local quota/idempotency, recovery, and
  configured Resend delivery path, while the visible product UI stays
  production-like without sandbox-only notices and every tracked production
  control remains unchanged. The supported app
  command is now the ordinary `make dev`; in the operator checkout it prepares and starts the app,
  local Worker, Dockerized Stripe listener, and bounded scheduled recovery runner
  as one attached Compose stack.
  It fails early when hosted email lacks its ignored local Resend credential and
  regression-checks that no production-enabled Worker control is disabled by the
  local overlay. `make dev-billing-sandbox` remains a compatible alias and
  `make dev-core` remains the explicit public/diagnostic fallback.
  The private per-service commands remain diagnostic escape hatches rather than
  the normal workflow. Program Phase 1 is
  complete locally. An owner-driven browser Checkout has also completed in
  Stripe test mode and converged to canonical Pro locally; this remains test
  evidence, not launch approval, and requires a current exportable Stripe test
  secret whenever it is repeated.
  Checkout now prefills the locally verified connected-account email as optional
  billing contact data and lets Stripe collect only the address detail it needs;
  it does not force a full address or separate TaskTime Terms checkbox. Existing
  Stripe billing email wins, and the contact never becomes identity or entitlement
  authority. Final live tax and consent treatment remains a Phase 4 approval.
  Hosted-email recovery is fully automatic and no-send after initial provider
  contact: it survives a crash between the retained terminal marker and Yjs sent
  metadata, hides Send as soon as the customer copy is confirmed, and bounds the
  modal spinner while list/focus recovery continues. Scheduled billing recovery
  also terminalizes a matching missed Checkout event and its founding allocation
  idempotently. Canonical local D1 schemas were adopted from preserved backups
  with row-equivalence, integrity, foreign-key, and strict schema attestation.
  Its sanitized test-mode evidence and cleanup result are retained in the
  private operational record. Owner-only
  live configuration, deployment, and launch inputs remain separate Program
  Phase 4 gates.

The July 2026 deep validation and Critical/High remediation are complete. Evidence, decisions, and the full release gate are recorded in `status/critical-path-assurance.md`.
The repository now has a zero-diagnostic TypeScript baseline enforced by the release gate; gradual source migration remains ongoing.

## Completed

**Foundation reconciliation — agent-kit 0.2.0**

- [x] Installed project-aware rules, skills, prompts, ownership manifest, and version marker.
- [x] Created populated specification, contract, architecture, environment, evaluation, and multi-layer status documents.
- [x] Validated required files, prompt/skill metadata, local references, environment coverage, route representation, Yjs collection coverage, and template removal.

**Critical-path assurance — July 2026**

- [x] Remediated sync/storage, backup/restore, billing/undo, reports/export, and agent trust findings.
- [x] Passed unit/integration coverage, lint, production build, browser/PWA smoke, and packaged live-agent gates.
- [x] Established and enforced a zero-diagnostic repository-wide TypeScript release baseline.

**Invoice cancellation — July 2026**

- [x] Delivered the six-slice terminal cancellation lifecycle across Yjs recovery, browser UI, reports/exports, backups, and agent surfaces.
- [x] Preserved invoice audit records and numbering while conditionally releasing only source work still owned by the canceled invoice.
- [x] Hardened first-commit eligibility, persisted-plan validation, late-arriving source reconciliation, protected later billing, and paid-only mark-as-unpaid behavior during pre-ship review.
- [x] Passed the final full release gate and packaged live-agent cancellation smoke; the `v1.2.0` release was published before the later direct-Drive releases.

## Blockers and open questions

- See `spec/ambiguities.md`. Remaining decisions concern future product work or compatibility-policy evolution; none blocks the completed assurance slice.
- Subscription launch-only allowance/grace/tax/legal/Stripe/Portal/support and
  remote-operation decisions remain explicitly unapproved and fail closed; see
  the private launch-decision packet. They do not block the completed local
  Phase 1 candidate.
- Provider-neutral sync is promoted as core app `1.5.0`; the compatible Worker/app rollout and focused production canary are complete. Agent bridge `1.1.0` is public on npm and MCP Registry, OpenClaw `1.1.0` is public on npm and ClawHub, and the repository-backed Claude `1.1.0` / marketplace `1.3.0` artifacts ship from `main`. The unchanged ClawHub skill stays at `1.2.1` and did not require republication. Broad Dropbox availability has one external two-part follow-up: obtain App Console production access, then pass the non-destructive post-approval sign-in/token/direct-file canary. This does not change the shipped code or direct-data privacy boundary.

## Quality gate

Behavior changes require red/green tests and Docker-backed checks. Documentation-only foundation changes require metadata, link, reference, and preservation validation; they do not require application tests unless executable files also change.
