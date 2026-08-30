# Implementation Roadmap

This roadmap describes the current production project rather than pretending it is greenfield.

## Phase 0 — Production foundation (completed)

- React/Vite PWA, Yjs/IndexedDB storage, Docker development, CI, core CRUD, tests
- Success evidence: production app, repository history, current unit/integration/browser suites

## Phase 1 — Core work, finance, sync, and public surfaces (completed)

- Projects/clients/tasks/planner/timers, expenses/tax, invoices/quotes/payments/reports, Drive sync, public Astro site
- Success evidence: implemented modules, generated artifacts, tests, and production use

## Phase 2 — Agent access and publishing (implemented; validation follow-through active)

- Browser command layer, local bridge, MCP tools, scopes/approvals, bundles, public docs, registry artifacts
- Active durability slice: same-tab refresh and same-profile reopen continuity, credential/status hardening, and conversion of the compatible OpenClaw bundle to a Gateway-owned native plugin while retaining generic MCP/Claude stdio compatibility
- Remaining success evidence: real installed OpenClaw long-running task/timer flow across later turns and browser close/reopen, migration/rollback validation, and remaining directory validation/publication
- Release intent: the current provider-neutral sync candidate is core app `1.5.0`, agent bridge/MCP Registry `1.1.0`, OpenClaw and Claude bundles `1.1.0`, Claude marketplace `1.3.0`, and unchanged ClawHub skill `1.2.1`; tagging, publication, and deployment require explicit approval

## Phase 3 — Agent-kit foundation reconciliation (completed)

- Add normalized specs, contracts, rules, architecture maps, environment examples, status, reusable skills, and prompts
- Cross-check these documents against code/tests and resolve recorded drift
- Success: all required foundation files exist, links/metadata validate, and no production source-of-truth was overwritten

## Phase 4 — Critical-path assurance (completed)

Thin review/remediation slices:

1. Stored-data and backup compatibility
2. Drive sync loss/conflict/reconnect behavior
3. Timer duration, stop idempotency, and time-entry exactness
4. Invoice calculations, currency, finalization, payment, and undo
5. Report/export total consistency
6. Import preview/restore safety

Each slice requires reconstructed contracts, representative historical fixtures, focused red/green regression coverage for findings, relevant Docker gates, and doc/status reconciliation.

The detailed finding-by-finding execution checklist and validation state live in `status/critical-path-assurance.md`. Remediation order is data-loss prevention first, then restore safety, billing exactness, report/export parity, and agent/security hardening.

## Phase 5 — Maintainability evolution

- Shared UI/agent work and time operations centralized for timer recovery, manual entries, recurring completion/skip state, and relationship-safe work-entity writes
- Gradual TypeScript migration
- Test infrastructure improvements
- Invoice cancellation completed: contract/lifecycle, shared replay-safe source release, browser/PDF safety, report/export parity, agent command parity, and backup `1.5` compatibility delivered and release-gated as six dependency-ordered slices
- Direct browser-to-Google Drive sync is released through the Worker OAuth/token control plane and memory-only browser tokens; the temporary staging environment and Worker data proxy are retired.
- Remaining approved product backlog such as task templates after recorded ambiguities are resolved
- Continued public-site indexing/SEO and agent distribution maintenance

## Phase 6 — Subscription billing and hosted-service entitlements (planned; locally implementation-ready, launch-gated)

- The approved initial Pro boundary is a net increase beyond Free's one active
  client, advanced Reports/ranges/exports and equivalent advanced report-agent
  scopes, and TaskTime-hosted invoice/quote/reminder email sending. `/reports`,
  its exact current-local-month Received/Expenses/Tracked-time Overview, every
  visible advanced-tab preview (including To Invoice), Dashboard/client/project/
  unbilled calculations, tax bookkeeping, email preparation/manual PDF delivery,
  invoices/quotes/PDFs, supported cloud sync/backups, portable import/export, Web
  Push, and core agents remain Free. Existing/imported/synced over-limit data is
  preserved and maintainable.
- Every eligible hosted principal authenticated through its selected Google
  Drive or Dropbox provider may explicitly activate one account-bound 30-day Pro
  trial with no payment method, Stripe subscription, automatic charge, renewal,
  or reset. Trial expiry removes only advanced Reports, hosted Send, and future
  active-client increases; it never mutates product/provider data.
- The private plan covers canonical D1 trial/subscription state, the exact annual
  `EUR 39` first-1,000 founding offer, atomic capacity, automatic annual
  `EUR 59` standard-offer transition, Stripe Billing/Portal/
  webhooks, signed subject-bound offline assertions, active-client compatibility,
  atomic email allowances, lazy Reports/free-path separation, account/deletion/
  support lifecycles, UI/agent parity, public-claim reconciliation, staged
  deployment, and non-destructive rollback.
- Implementation/security contracts are frozen in the private plan. Local
  Slices 0-8 use the exact test-mode `EUR 39/year` founding and `EUR 59/year`
  standard offers plus synthetic fixtures only for still-open email allowance,
  paid grace, tax presentation,
  seller/legal/support, and payment/refund/Portal policy. Work may
  proceed only while every production billing/trial/Checkout/upsell/enforcement
  control is off and current production features remain available.
- Local delivery order is the frozen contract/owned launch-decision packet,
  inert Worker/trial/schema foundation, order-independent Stripe/founding-slot
  reconciliation, hardened status/trial/Checkout APIs, client shadow state,
  shared active-client transition enforcement, Free Reports Overview plus lazy
  Pro previews/policy, Pro email with an atomic synthetic allowance, and expiry/
  downgrade/free-path reconciliation. Final commercial/legal approvals occur
  only in the controlled production-launch phase.
- Public positioning continues to say TaskTime is free, open source, and local-first; Pro is an optional time-saving upgrade rather than a prerequisite for core use.
- Program Phase 1 local evidence requires Worker tests/typecheck, the core release
  gate, one-time trial/expiry, 1,001-way founding contention/continuity,
  founding-to-standard selection/reconfirmation with no standard slot mutation,
  active-client compatibility, UI/agent parity, Free Overview/protected-load separation,
  advanced Reports/email/free-path and tax-bookkeeping coverage, multi-device/
  offline/downgrade/account-switch evidence, Stripe test-mode lifecycle evidence,
  all three enforcement rollback paths, and proof all production controls remain
  off.
- Program Phase 4 launch evidence separately requires approved live commercial/
  legal configuration, explicit owner authorization, one exact `EUR 39/year`
  founding canary that permanently consumes an allocation, one exact
  `EUR 59/year` standard canary that consumes none, exact deployed-version
  evidence, and independently verified active-client/advanced-Reports/email
  rollback flags.

## Phase 7 — Provider-neutral cloud sync and Dropbox (connections and transfers deployed; broad access follow-up)

- The behavior contract is `spec/features/provider-neutral-cloud-sync-and-dropbox.md`; Google Drive and Dropbox connections plus explicit user-initiated provider transfers are deployed/enabled for approved/current accounts with independent fail-closed rollback controls. No transfer starts automatically.
- Product and agent parity, compatible Worker/app deployment, remote D1 migration, production secrets/flags, moved-source recovery, owner canaries, and transfer enablement are complete. Broad Dropbox availability to new public users remains gated on Dropbox App Console production access followed by a non-destructive sign-in/token/direct-file canary.
- Preserve the deployed direct Google Drive flow while extracting one provider-neutral sync/manifest/backup core and adding Dropbox through a least-privilege App Folder adapter.
- Keep exactly one active provider per browser profile. Do not mirror providers. A verified, crash-resumable transfer copies the complete live workspace in either direction, creates one target handoff backup, activates the target only after readback verification, and retains source files and historical backups.
- Keep routine manifests, Yjs state/deltas, backups, restores, wipes, and transfer bodies directly between the browser and the selected provider. The Worker remains an OAuth/encrypted-refresh-token/short-lived-token/revocation control plane and never becomes a Dropbox file proxy.
- Preserve Manual, Backup, and Sync semantics, Google manifests/files/sessions, the existing cross-tab lock name, dirty recovery, request budgets, and Drive UI/API compatibility facades. Provider-neutral agent commands are canonical; already-shipped Drive-named commands remain deprecated Google-only compatibility aliases until a major-version migration can remove them safely.
- The Workers Rate Limiting bindings and measured capacity/plan gate were completed before the current Dropbox enablement. Preserve those bindings, doubled-peak headroom evidence, and the rule that encrypted sessions move to D1 or a paid KV plan before any future rollout if capacity no longer passes.
- Make the selected provider session authoritative for storage and TaskTime-hosted services. Provider-separated subjects map to one opaque hosted principal, and verified transfer links that principal before activation so hosted email, metrics, and future Pro state move end to end without requiring Google.
- Deliver through the checklist in `status/cloud-sync-provider-expansion.md`: contract/baseline, Drive characterization, Google-compatible seams, Worker capacity/session foundation, Dropbox direct vertical, provider lifecycle, hidden parity, verified transfer, product/agent parity, and staged release.
- Success evidence requires Google non-regression, both-provider contract/mode/request-count tests, both transfer directions with failure injection and lazy data, token/privacy/cache proof, Worker tests/typecheck, the full app release gate, supported-browser credential canaries, Dropbox production approval, capacity evidence, rollback proof, and explicit release/deployment approval.

## Coordinated delivery program — License, app origin, homepage, and launch (planned)

This delivery sequence spans existing roadmap phases; its Program Phase numbers are release-order labels rather than replacements for the product roadmap above.

1. Complete the provider-neutral subscription/license flow and its Worker, client, UI, agent, compatibility, rollback, and local release evidence with every production billing/trial/Checkout/enforcement control disabled.
2. Prepare the move of the application from `https://tasktime.pro` to `https://app.tasktime.pro` locally. The migration must explicitly transfer existing origin-local workspace data, leave source data untouched until verified, use the same reconnect/bootstrap lifecycle for Google Drive and Dropbox, and re-establish rather than copy origin-scoped credentials, licenses, Push subscriptions, and agent pairing state.
3. Complete the public homepage and related UX/UI adjustments so `https://tasktime.pro` is the marketing/documentation origin and all app-entry flows target `https://app.tasktime.pro`.
4. Launch through separately approved, observable, and reversible Worker, app, user-migration, homepage, agent-artifact, and billing-enforcement steps.

Program Phase 1 is the implementation dependency. It freezes a stable logical license audience and configurable exact-origin/return-URL seams before Program Phase 2, but the domain migration does not need to precede local license completion. The private implementation sources are `docs/todo/client_edge_license_flow.md` and `docs/todo/app_subdomain_migration_implementation_plan.md` in `tasktime-infra`; the operational checklist in `TODO.md` tracks progression across all four phases.
