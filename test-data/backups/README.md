# TaskTime Pro Backup Fixtures

These files are importable backup payloads that match the current TaskTime Pro manual export format.

Files:
- `tasktime-sample-backup-v1.3.json`: Broad mixed workspace covering clients, projects, tasks, time entries, invoices, expenses, recurring expenses, planner attachments, daily goals, active data, and archived data.
- `tasktime-invoice-edge-backup-v1.3.json`: Invoice-focused fixture covering draft, sent, overdue, paid, archived, tax-enabled, tax-disabled, currency snapshot, and reimbursable-expense invoice cases.
- `tasktime-expenses-tax-backup-v1.3.json`: Expenses-focused fixture covering claimed, unclaimed, and excluded tax states, recurring expenses, upcoming previews, unpaid expenses, active historical expenses, and archived expenses.

Validation:
- Store-level fixture tests import these backups through the real Yjs import path.
- Playwright smoke coverage imports these exact JSON files through the UI.

Recommended use:
- Use the broad sample when testing end-to-end workspace behavior.
- Use the focused fixtures when changing invoice logic, reports, expense filters, tax summaries, or recurring expense flows.
