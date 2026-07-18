# App Status

## Current focus

- [x] Make direct Drive sync more responsive without weakening mode boundaries: Backup and Sync modes debounce note edits for 1.5 seconds, pending local work retries with bounded backoff after active-sync/Web Lock contention, Sync mode checks every five minutes only while visible, and Manual mode remains explicit-only.
- [x] Retire the Drive data proxy and temporary staging environment. Active Worker version `37` serves direct Drive control-plane sessions only, denies old `/drive/*` browser preflight without CORS permission, and permits the exact local production-preview origin. The isolated staging Worker, KV namespace, D1 databases, secret file, config, tests, and runbook are removed. Current privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy state the direct browser-to-Google Drive boundary.
- [x] Complete all six invoice-cancellation slices: terminal retained records, replay-safe source release, Canceled UI/PDF safety, zero-contribution financial reporting, agent parity, and backup `1.5` compatibility.
- [x] Expose the existing paid-invoice correction in the browser three-dot menu with explicit confirmation, paid-only eligibility, refund-safe wording, payment-detail clearing, preserved billing-source claims, and Outstanding/Overdue routing.
- [x] Complete pre-ship hardening for cancellation commit races, persisted-plan field constraints, late-arriving owned claims, protected later billing, and theme-aware canceled-state UI tokens.
- [x] Release the completed cancellation scope as `v1.2.0`: core app `1.2.0`, backup contract `1.5`, agent bridge/MCP and OpenClaw/Claude bundles `0.3.0`, ClawHub skill `1.1.0`, and Claude marketplace `1.1.0`; no private Worker change was required.
- [x] Cross-validate critical persistence and billing specifications against implementation and historical fixtures.
- [x] Complete the dependency-ordered remediation and release checklist in `status/critical-path-assurance.md`.
- [ ] Continue gradual TypeScript migration without breaking stable imports or persisted contracts.
- [x] Establish a zero-diagnostic repository-wide TypeScript baseline and enforce it in the release gate.
- [ ] Improve testing infrastructure while preserving the per-file coverage gate for hooks and utilities.
- [x] Centralize timer lifecycle/recovery, manual time-entry protection, recurring task state, and relationship-bearing work-entity writes across UI and agent surfaces.
- [x] Fail closed on duplicate entity creates, protect billed/tax-claimed expense deletion, and commit paid cross-currency expense mutations only after snapshot preparation.
- [x] Align individual dashboard time-entry and Hours-report total/billable durations with the seconds-aware task display so sub-minute work never appears as `0m`.

## Production baseline

- [x] Yjs multi-document storage and IndexedDB persistence
- [x] Manual, backup, and bidirectional Drive sync modes
- [x] Projects, clients, tasks/subtasks, timers, time entries, planner, goals, and notes
- [x] Expenses, recurrences, tax periods, invoices, quotes, payments, reports, and export/import
- [x] Responsive PWA shell, offline indicator, service worker, and mobile navigation

The July 2026 critical-path assurance phase supplies deeper edge-case, historical-compatibility, failure-injection, browser, PWA, and live-agent evidence for this baseline.
