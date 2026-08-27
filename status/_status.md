# Delivery Status — Overview

This coordinator tracks active execution. Detailed work lives in `app-status.md`, `agent-status.md`, and `site-status.md`. `TODO.md` remains the broader backlog and ideas list.

## Overall state

TaskTime Pro is in production. The core local-first app, Drive sync, invoicing/reporting, public site, and local agent bridge are implemented. Current work focuses on assurance, compatibility, TypeScript migration, and publishing/validation follow-through rather than greenfield delivery.

## Current phase

**OpenClaw durability, maintainability evolution, and publishing follow-through**

- Direct browser-to-Google Drive sync is deployed. Active Worker version `37` retains only OAuth/token control-plane duties, rejects the retired `/drive/*` route without CORS permission, and permits the exact `http://localhost:3101` production-equivalent preview origin. The temporary staging Worker, KV namespace, D1 databases, local secrets/configuration, tests, and runbook have been removed. Privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy state the direct browser-to-Google Drive boundary; the latest Pages production deployment is `fe29474d-f608-4a31-abe6-1840ad27c4bf`.
- Offline lazy-document navigation now short-circuits before any remote Drive work and subscribes locally; a red/green provider regression covers the cached-manifest case that previously produced failed offline requests. Focused provider tests, app typecheck, lint, and diff checks are green.
- Direct Drive auto-sync now batches project-note typing after a 1.5-second quiet period, retries genuine pending work after active-sync/Web Lock contention with bounded backoff, and checks for remote changes every five minutes only while Sync mode is visible.
- The browser retest confirms offline navigation now produces neither Drive requests nor upload errors.
- Provider-neutral cloud sync with Dropbox is approved as one sliced phase. Implementation through Slice 9 plus the provider-identity parity reconciliation is complete, and the next-release client now enables Dropbox entry points by default with an explicit false emergency opt-out: Google remains on tested compatibility facades; Dropbox has provider-bound Worker control endpoints, memory-only browser tokens, a direct App Folder adapter, provider lifecycle/mode parity, a durable verified transfer coordinator, provider-aware UI/agents, and the same hosted email/metrics/future-Pro identity boundary as Google. Cloud Sync, Account sign-out/deletion, mobile status, import guidance, project-note sync, and agent deletion now use the active-provider boundary; connected-provider UX exposes only Disconnect and Wipe data & disconnect, with sync files and backups removed before revocation. Verified transfer links one opaque hosted principal before activation and locally disconnects the former provider; routine file bodies still bypass the Worker. The owner-only Dropbox app, ignored local credentials/salts/flags, production hosted-identity D1 resource/source binding, local D1 schema, Dropbox-enabled local app targets, and next-release public/legal copy are prepared. The complete local Microsoft Edge canary covered OAuth, direct App Folder access, Manual/Backup/Sync behavior, request counts, backup create/list/download, two-tab convergence, offline recovery, verified wipe/revoke cleanup, local-data retention, and final Google reconciliation. It also completed real-account Google Drive to Dropbox and Dropbox to Google Drive transfers with target readback, source retention, hosted-principal continuity, source-session-only disconnect, clean target sync, and a retained Dropbox backup. The canary exposed Chromium's byte-empty `POST` stream representation at the hosted-identity link boundary; the Worker now accepts only truly empty streams while continuing to reject any payload. Its findings have shared Google Drive/Dropbox regression coverage, including optional response metadata, serialized lazy-document manifest work, exact recovery-marker cleanup/rehydration, the pending-to-clear UI notification, reuse of a recovery full-state write for forced verification, one-second coalescing of paired visibility/online wake signals without suppressing later recovery, and status-request deduplication with retryable transient failure. No Worker or app change is deployed, the remote D1 migration and production secrets remain unapplied, all tracked production Worker Dropbox controls remain off, and production supported-browser network canaries plus coordinated Worker-first enablement remain open.
- Current local provider-parity validation is green: app lint, typecheck, production app/blog build, 239 test files / 2,215 tests with coverage (93.12% statements, 82.67% branches, 94.27% functions, and 94.19% lines), 38/38 Chromium smoke tests, 2/2 PWA smoke tests, direct Google transport in Chromium/Firefox/WebKit, private Worker typecheck and 13 files / 105 tests, plus bridge and OpenClaw package dry-runs and the packaged bridge, managed-bundle, and live MCP smoke flow. This is local evidence only and does not close the remaining compatible Worker deployment, remote D1 migration, production-secret/flag, or supported-browser production canary gates.
- Gradual TypeScript and testing-infrastructure improvements
- Installed OpenClaw validation and remaining agent-directory publication checks
- OpenClaw durability implementation and automated release evidence are complete: credentials/contracts are reconciled, status/logging are hardened, browser refresh and same-profile reopen continuity are covered, and the native plugin owns one Gateway-lifecycle bridge while generic MCP/Claude stdio remain supported. CLI/Gateway alignment and disposable-profile migration/rollback now pass on `2026.7.1-2`; the final installed plugin/browser multi-turn acceptance remains pending.
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
- [x] Passed the final full release gate and packaged live-agent cancellation smoke; the `v1.2.0` release was published before the later direct-Drive releases.

## Blockers and open questions

- See `spec/ambiguities.md`. Remaining decisions concern future product work or compatibility-policy evolution; none blocks the completed assurance slice.
- The current provider-neutral sync release candidate is prepared as core app `1.5.0`, agent bridge/MCP Registry `1.1.0`, OpenClaw and Claude bundles `1.1.0`, Claude marketplace `1.3.0`, and unchanged ClawHub skill `1.2.1`. Local build, package, bundle, and live MCP gates pass. Tagging, publication, Worker/app deployment, and production rollout remain separately approval-gated.

## Quality gate

Behavior changes require red/green tests and Docker-backed checks. Documentation-only foundation changes require metadata, link, reference, and preservation validation; they do not require application tests unless executable files also change.
