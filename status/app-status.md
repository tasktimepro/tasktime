# App Status

## Current focus

- [x] Cross-validate critical persistence and billing specifications against implementation and historical fixtures.
- [x] Complete the dependency-ordered remediation and release checklist in `status/critical-path-assurance.md`.
- [ ] Continue gradual TypeScript migration without breaking stable imports or persisted contracts.
- [x] Establish a zero-diagnostic repository-wide TypeScript baseline and enforce it in the release gate.
- [ ] Improve testing infrastructure while preserving the per-file coverage gate for hooks and utilities.
- [x] Centralize timer lifecycle/recovery, manual time-entry protection, recurring task state, and relationship-bearing work-entity writes across UI and agent surfaces.
- [x] Fail closed on duplicate entity creates, protect billed/tax-claimed expense deletion, and commit paid cross-currency expense mutations only after snapshot preparation.
- [x] Align individual dashboard time-entry durations with the seconds-aware task display so sub-minute work never appears as `0m`.

## Production baseline

- [x] Yjs multi-document storage and IndexedDB persistence
- [x] Manual, backup, and bidirectional Drive sync modes
- [x] Projects, clients, tasks/subtasks, timers, time entries, planner, goals, and notes
- [x] Expenses, recurrences, tax periods, invoices, quotes, payments, reports, and export/import
- [x] Responsive PWA shell, offline indicator, service worker, and mobile navigation

The July 2026 critical-path assurance phase supplies deeper edge-case, historical-compatibility, failure-injection, browser, PWA, and live-agent evidence for this baseline.
