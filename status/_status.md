# Delivery Status — Overview

This coordinator tracks active execution. Detailed work lives in `app-status.md`, `agent-status.md`, and `site-status.md`. `TODO.md` remains the broader backlog and ideas list.

## Overall state

TaskTime Pro is in production. The core local-first app, Drive sync, invoicing/reporting, public site, and local agent bridge are implemented. Current work focuses on assurance, compatibility, TypeScript migration, and publishing/validation follow-through rather than greenfield delivery.

## Current phase

**Maintainability evolution and publishing follow-through**

- Direct browser-to-Google Drive sync is deployed by default. Isolated staging passes unauthenticated smoke, OAuth/encrypted-session/direct-token checks, wipe/revoke, recovery, request-budget checks, and proxy/direct interchange without migration. Slice 4 uses explicit transport injection, direct reads/mutations, pre-generated/reconciled create IDs, reason-aware retries, rollback-to-next-connection handling, shared connection/sync Web Locks, and a standards-correct direct-only `multipart/related` upload body after a WebKit `FormData` metadata incompatibility. Docker includes the pinned Chromium, Firefox, and WebKit engines; the dedicated direct-transport smoke passes in all three and rejects Worker data-proxy use. This is mocked browser transport coverage, not authenticated Google acceptance. Core `v1.3.2` (commit `5dfbf76`) is manually deployed to production Pages and serves asset `index-DUg5TbeK.js`. Worker version `3bb810e7-cd9d-4919-899b-ef40a82071a8` is live on `sync.tasktime.pro` with `DIRECT_DRIVE_ROLLOUT_PERCENT=100`; its fail-closed PWA-version gate permits direct Drive only for v1.3.2+ and keeps cached/older clients on the proxy. Live health, versioned CORS preflight, and unauthenticated no-store rejection pass. The retained proxy is the rollback transport. Authenticated Firefox/Safari acceptance and the full long-running regression matrix remain tracked compatibility evidence rather than release blockers.
- Mixed-transport privacy, terms, contracts, specifications, architecture, contributor guidance, and future entitlement wording are published on the production site and reconciled in the public/private repositories. The published text accurately describes both a policy-selected direct browser-to-Google Drive path and the retained compatibility proxy; it will be tightened again only when direct becomes the production default.
- Offline lazy-document navigation now short-circuits before any remote Drive work and subscribes locally; a red/green provider regression covers the cached-manifest case that previously produced failed offline requests. Focused provider tests, app typecheck, lint, and diff checks are green.
- The browser retest confirms offline navigation now produces neither Drive requests nor upload errors.
- Gradual TypeScript and testing-infrastructure improvements
- Installed OpenClaw validation and remaining agent-directory publication checks
- Approved product backlog after its recorded ambiguities are resolved

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
- [x] Passed the final full release gate and packaged live-agent cancellation smoke; the `v1.2.0` release is committed and tagged locally, while remote publication and deployment remain pending separate authorization.

## Blockers and open questions

- See `spec/ambiguities.md`. Remaining decisions concern future product work or compatibility-policy evolution; none blocks the completed assurance slice.

## Quality gate

Behavior changes require red/green tests and Docker-backed checks. Documentation-only foundation changes require metadata, link, reference, and preservation validation; they do not require application tests unless executable files also change.
