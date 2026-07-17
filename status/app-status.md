# App Status

## Current focus

- [ ] Complete the direct browser-to-Google Drive sync compatibility window: the Worker token/policy/auth-hardening and Slice 3 memory-only credential foundation are complete; staging passes OAuth/recovery/data checks, request budgets, direct mutation/recovery, and bidirectional proxy/direct file interchange. Slice 4 uses explicit direct/proxy selection, direct reads/writes, stable create IDs/reconciliation, sanitized retries, next-connection rollback, connection/sync Web Locks, offline lazy-document suppression, and standards-correct direct-only `multipart/related` uploads. Docker now includes pinned Chromium, Firefox, and WebKit; the dedicated direct-transport smoke confirms Google routing, short-lived-token use, multipart POST/PATCH, and no Worker data proxy in all three. This mocked transport coverage does not replace authenticated Google acceptance. Core `v1.3.2` (commit `5dfbf76`) is manually deployed to production Pages, and Worker `3bb810e7-cd9d-4919-899b-ef40a82071a8` is live with direct rollout `100%`. The fail-closed client-version gate and versioned control-plane URLs select direct Drive only for v1.3.2+ while preserving proxy compatibility for cached/older versions and rollback. Live health, CORS preflight, no-store unauthenticated token rejection, and the served production asset pass. Privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy describe direct as the default for current compatible clients. Authenticated Firefox/Safari and the full long-running request matrix remain tracked compatibility evidence; the proxy remains until an explicit later retirement decision.
- [x] Complete all six invoice-cancellation slices: terminal retained records, replay-safe source release, Canceled UI/PDF safety, zero-contribution financial reporting, agent parity, and backup `1.5` compatibility.
- [x] Expose the existing paid-invoice correction in the browser three-dot menu with explicit confirmation, paid-only eligibility, refund-safe wording, payment-detail clearing, preserved billing-source claims, and Outstanding/Overdue routing.
- [x] Complete pre-ship hardening for cancellation commit races, persisted-plan field constraints, late-arriving owned claims, protected later billing, and theme-aware canceled-state UI tokens.
- [x] Release the completed cancellation scope locally as `v1.2.0`: core app `1.2.0`, backup contract `1.5`, agent bridge/MCP and OpenClaw/Claude bundles `0.3.0`, ClawHub skill `1.1.0`, and Claude marketplace `1.1.0`; no private Worker change is required, and remote publication or deployment remains pending separate authorization.
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
