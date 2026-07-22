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
