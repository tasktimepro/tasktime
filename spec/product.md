# Product Specification

## Product

TaskTime Pro is a free, open-source, local-first work-management and billing application for freelancers and solo professionals. It combines projects, clients, hierarchical tasks, planning, timers, expenses, invoicing, and reporting without requiring a hosted account or cloud sync for core use.

## Product promise

- Work data remains available locally and offline.
- Core use remains free, requires no TaskTime account, and stores work records in browser-local storage.
- Time can move from a task/timer into reports and billing without manual re-entry.
- Financial actions remain understandable, reviewable, and reversible where the product supports reversal.
- Optional Drive sync and backup improve portability without becoming mandatory for core use.
- Optional same-device agent access uses the same business actions as the UI and remains under explicit user control.

## Primary users

- Independent professionals tracking multiple clients and projects
- Freelancers billing hourly, flat-rate, quoted, or mixed work
- Solo operators tracking expenses and tax-return periods
- Users who want local ownership with optional cross-device synchronization

## Core outcomes

1. Organize client and project work into actionable tasks and weekly plans.
2. Capture accurate time with multiple project timers and manual entries.
3. Convert eligible work and expenses into quotes or invoices without double billing.
4. Track payments, expenses, tax states, and reporting totals consistently.
5. Export records, documents, reports, and backups in useful formats.
6. Recover and synchronize data without silently losing valid local or remote changes.
7. Delegate approved same-device actions to an agent without surrendering raw storage access.

## Product boundaries

- TaskTime Pro is not a multi-user hosted collaboration platform.
- The browser is the primary product runtime and data owner.
- Google Drive, push, email, diagnostics, and agent integrations are optional extensions.
- The production origin may send limited aggregate usage metrics, but those metrics exclude project, task, client, invoice, expense, note, time-entry, and other raw work-record content.
- The public repository does not contain the private sync/notification Worker implementation or operational secrets.

## Success principles

- Accuracy and data preservation outrank convenience.
- Critical state transitions are explicit and testable.
- The app remains useful offline.
- Mobile and desktop layouts support the same domain behavior with form-factor-appropriate presentation.
- New capabilities reuse existing data, domain, UI, and command layers rather than creating parallel paths.
