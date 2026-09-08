# Expenses, Tax, And Reports

## Behavior

- Expenses carry amount/currency, date/due/payment state, optional client/project/category/supplier/tax/invoice relationships, and conversion snapshots where applicable.
- Recurrences deterministically create/manage expected expense occurrences and can pause/resume.
- Tax-return periods group explicit claimed/filed/paid states.
- Reports aggregate canonical time, billed/unbilled work, invoices/payments, expenses, and tax data under shared filters.
- The main Expenses overview adds period paid-spend, estimated monthly recurring
  commitments, existing upcoming-occurrence totals, category shares, monthly
  history, and recorded activity as read-only projections of active and archived
  records. Metric scopes and responsive ordering follow
  [Expenses overview](../designs/billing-and-finance.md#expenses-overview).
  Existing expense rows, tabs, filters, status buckets, and mutation paths remain
  unchanged. History failures expose retry rather than a complete-looking total;
  nested archived-record changes refresh these projections.
- Billable hours, utilization, work summaries, and uninvoiced time require a
  billable task in a non-personal project with its matching existing client.
  Browser reports and agent report/export results share this read-only rule.
  Internal/standalone work stays in actual tracked totals; saved task preferences,
  time entries, and finalized invoice snapshots are not rewritten.
- Uninvoiced hours use canonical eligibility, including legacy rate markers and
  exact finalized-invoice evidence. Browser history loading includes legacy
  source periods before the visible report filter is applied, so a narrow
  report or task move cannot reopen part of a previously billed merged task.
- CSV, PDF, ZIP, and accountant outputs use the same filter and calculation semantics as the visible report.
- Paid cross-currency expense creation and payment-sensitive updates prepare and validate their payment snapshot before the expense mutation is committed. Recurrence generation advances its cursor only after every due occurrence was created successfully.
- Billed or tax-claimed expenses are protected records: both browser and agent deletion paths reject them until the invoice or tax-return relationship is explicitly reversed.
- Canceling an eligible invoice returns only expenses still claimed by that invoice to unbilled state. Expense payment, tax claim/period, recurrence, receipt, supplier, original currency, and conversion evidence remain unchanged.
- Canceled invoices remain available in invoice-register audit rows but contribute zero to revenue, payment, output-tax, profit, receivables, aging, statements, and project allocation totals across the UI, CSV, PDF, ZIP/accountant pack, and agent reports.

## Edge cases

- Date boundaries, unpaid/paid/canceled transitions, recurrence catch-up and retry, duplicate active/archive identity, protected deletion, multiple currencies, unavailable conversion rates, archived data, tax claim retention after invoice cancellation, canceled audit rows versus financial scopes, and rounding precedence.

## Evidence

Expense/tax domain and hook tests, recurrence integration flows, report calculation/date/CSV/PDF/pack tests, invoice-payment workflows, and report/expense Playwright tests.
