# Expenses, Tax, And Reports

## Behavior

- Expenses carry amount/currency, date/due/payment state, optional client/project/category/supplier/tax/invoice relationships, and conversion snapshots where applicable.
- Recurrences deterministically create/manage expected expense occurrences and can pause/resume.
- Tax-return periods group explicit claimed/filed/paid states.
- Reports aggregate canonical time, billed/unbilled work, invoices/payments, expenses, and tax data under shared filters.
- CSV, PDF, ZIP, and accountant outputs use the same filter and calculation semantics as the visible report.
- Paid cross-currency expense creation and payment-sensitive updates prepare and validate their payment snapshot before the expense mutation is committed. Recurrence generation advances its cursor only after every due occurrence was created successfully.
- Billed or tax-claimed expenses are protected records: both browser and agent deletion paths reject them until the invoice or tax-return relationship is explicitly reversed.

## Edge cases

- Date boundaries, unpaid/paid transitions, recurrence catch-up and retry, duplicate active/archive identity, protected deletion, multiple currencies, unavailable conversion rates, archived data, tax claim reversal, and rounding precedence.

## Evidence

Expense/tax domain and hook tests, recurrence integration flows, report calculation/date/CSV/PDF/pack tests, invoice-payment workflows, and report/expense Playwright tests.
