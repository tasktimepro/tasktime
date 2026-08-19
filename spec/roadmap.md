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
- Release intent: the prepared candidate is core app `1.4.0`, agent bridge/MCP Registry `1.0.0`, OpenClaw and Claude bundles `1.0.0`, and ClawHub skill/Claude marketplace `1.2.0`; publication requires aligned real-profile acceptance and explicit approval

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

## Phase 6 — Subscription billing and hosted-service entitlements (planned; decision-gated)

- The approved initial Pro boundary is the main Reports workspace and report-specific browser/agent exports plus TaskTime-hosted invoice/quote/reminder email sending. The current Dashboard metrics widget, local core workflows, invoices/quotes and PDFs, Drive sync/backups, portable import/export, Web Push, and equivalent core agent workflows remain free without entity limits.
- Every eligible existing or new account may explicitly activate one account-bound 30-day Pro trial with no payment method, Stripe subscription, automatic charge, renewal, or reset. Trial expiry returns only Reports and hosted email to their Free states and never mutates product/Drive data.
- The private plan covers canonical D1 trial/subscription state, Stripe Billing/Portal/webhooks, signed subject-bound offline assertions capped at trial expiry, atomic email allowances, Reports/dashboard/tax-maintenance boundaries, account/deletion/support lifecycles, UI/agent parity, careful public-claim reconciliation, staged deployment, and non-destructive rollback.
- Remaining open Phase 0 decisions in `spec/ambiguities.md` block Checkout, trial activation, and enforcement. Disabled Worker/schema, entitlement, and shadow-UI slices may proceed only while every current production feature remains available.
- Delivery order is remaining contracts/decisions, inert Worker/trial/schema foundation, order-independent Stripe reconciliation, hardened status/trial/Checkout APIs, client shadow state, Reports upsell/trial/shared policy, Pro email with atomic allowance, downgrade/free-path reconciliation, then controlled public launch.
- Public positioning continues to say TaskTime is free, open source, and local-first; Pro is an optional time-saving upgrade rather than a prerequisite for core use.
- Success evidence requires Worker tests/typecheck, the core release gate, exact one-time trial/expiry proof, UI/agent parity, Reports/email/free-path and tax-correction coverage, multi-device/offline/downgrade/account-switch evidence, Stripe test-mode lifecycle evidence, approved live trial and low-value purchase validation, exact deployed-version evidence, owner approval, and separately tested Reports/email rollback flags.

## Phase 7 — Provider-neutral cloud sync and Dropbox (planned; one sliced phase)

- Preserve the deployed direct Google Drive flow while extracting one provider-neutral sync/manifest/backup core and adding Dropbox through a least-privilege App Folder adapter.
- Keep exactly one active provider per browser profile. Do not mirror providers. A verified, crash-resumable transfer copies the complete live workspace in either direction, creates one target handoff backup, activates the target only after readback verification, and retains source files and historical backups.
- Keep routine manifests, Yjs state/deltas, backups, restores, wipes, and transfer bodies directly between the browser and the selected provider. The Worker remains an OAuth/encrypted-refresh-token/short-lived-token/revocation control plane and never becomes a Dropbox file proxy.
- Preserve Manual, Backup, and Sync semantics, Google manifests/files/sessions, the existing cross-tab lock name, dirty recovery, request budgets, Drive UI/API compatibility facades, and Drive-named agent commands.
- Replace KV-backed abuse counters with Workers Rate Limiting bindings before Dropbox exposure. Public rollout requires measured doubled-peak headroom on the selected Cloudflare plan; encrypted sessions move to D1 or a paid KV plan first if that gate fails.
- Keep storage-provider sessions separate from billing, hosted-email, metrics, and product identity. This phase does not resolve the open billing OAuth decision by treating Dropbox identity as a substitute.
- Deliver through the checklist in `status/cloud-sync-provider-expansion.md`: contract/baseline, Drive characterization, Google-compatible seams, Worker capacity/session foundation, Dropbox direct vertical, provider lifecycle, hidden parity, verified transfer, product/agent parity, and staged release.
- Success evidence requires Google non-regression, both-provider contract/mode/request-count tests, both transfer directions with failure injection and lazy data, token/privacy/cache proof, Worker tests/typecheck, the full app release gate, supported-browser credential canaries, Dropbox production approval, capacity evidence, rollback proof, and explicit release/deployment approval.
