# Invoicing, Quotes, And Payments

## Behavior

- Preview gathers eligible unbilled time/tasks/expenses into explicit invoice line and project-breakdown data.
- Drafts remain editable without applying billed markers.
- Finalization snapshots billing/currency/branding data and applies source billing state once.
- Payments record their financial context; marking unpaid reverses only the payment state defined by the domain operation.
- Undo latest invoice uses stored billing snapshots to restore eligible source records safely.
- Quote preview/export/email operates in quote mode and does not claim work as billed.

## Edge cases

- Mixed hourly/flat work, billing increments, expense currency conversion, tax-disabled clients, discounts/tax, repeated finalization/undo/payment calls, archived invoices, missing legacy snapshots, and later unrelated work.

## Evidence

Invoice domain/application tests, pricing/calculation/date utilities, invoice UI/integration tests, PDF/email tests, report tests, and billing-scoped agent command tests.
