# Invoicing, Quotes, And Payments

## Behavior

- Preview gathers eligible unbilled time/tasks/expenses into explicit invoice line and project-breakdown data.
- Drafts remain editable without applying billed markers.
- Finalization snapshots billing/currency/branding data and applies source billing state once.
- Payments record their financial context. **Mark as unpaid** is a confirmed correction for a mistakenly recorded payment: it removes `paidAt` and the payment-currency snapshot, preserves the finalized invoice and its billing-source claims, and returns the invoice to effective Outstanding or Overdue. It does not record or issue a refund.
- Undo latest invoice uses stored billing snapshots to restore eligible source records safely.
- Cancellation is a terminal, void-like workflow for finalized unpaid invoices whose effective status is sent or overdue. It preserves the invoice, number, original totals, immutable snapshots, sent metadata, and project links while releasing only billing sources still owned by that invoice.
- Cancellation requires a trimmed reason of 1–500 characters and exact invoice-number confirmation. It is journaled, retry-safe, and shared by the browser and agent surfaces.
- Canceled invoices remain available as immutable audit records but are non-payable, non-emailable, excluded from financial/report totals, and unmistakably marked in retained PDF output. Their numbers remain permanently consumed.
- Quote preview/export/email operates in quote mode and does not claim work as billed.

## Lifecycle distinctions

- Delete draft edits or removes an unissued record and does not use cancellation.
- Undo latest invoice remains the narrow correction flow that deletes the latest eligible unpaid invoice, releases its sources, unlinks it from projects, and may rewind a simple sequence when safe.
- Cancel invoice retains the issued invoice and project links, releases sources, never rewinds numbering, and cannot be reversed.
- Mark unpaid corrects a mistakenly recorded payment state; it does not cancel the invoice or release billing sources.
- Corrections to an actually settled or tax-accounted invoice, refunds, credit notes, debit notes, partial cancellation, uncancel, and customer cancellation notices are outside the cancellation phase.

## Edge cases

- Mixed hourly/flat work, billing increments, expense currency conversion, tax-disabled clients, discounts/tax, repeated finalization/undo/payment/cancellation calls, archived and historical sources, missing legacy snapshots, later unrelated work, stale Drive replay, and interrupted multi-document operations.

## Evidence

Invoice domain/application tests, pricing/calculation/date utilities, invoice UI/integration tests, PDF/email tests, report tests, and billing-scoped agent command tests.
