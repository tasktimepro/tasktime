# Invoicing, Quotes, And Payments

## Behavior

- Preview gathers eligible unbilled time/tasks/expenses into explicit invoice line and project-breakdown data.
- Drafts remain editable without applying billed markers.
- Saved drafts are an optional prepare-now/finish-later step in both browser and
  agent workflows. Saving, reopening, editing and deleting a draft neither claim
  source work nor advance final invoice numbering. New automatic draft numbers
  are provisional; finalization allocates a current unused final number.
- Drafts appear separately from Outstanding and offer edit, explicit finalize
  and confirmed delete actions. Sending and payment actions require finalization.
  Preview/download clearly identify an unfinalized document as Draft, including
  a new invoice preview before its first save.
- A saved draft captures selected source entries, linked expenses, rates and
  adjustments. Reopening does not silently add later work. Explicit Refresh Work
  rebuilds linked work from current eligibility for the selected projects and
  period, after explaining that linked-line selections and overrides are reset;
  manual items, invoice notes and overall discount/shipping/tax settings remain.
- Refresh also supports client-only expense invoices without a project. It
  retains the saved period and invoice currency, includes eligible expenses
  once, and leaves the draft unchanged if required exchange rates are missing.
- UI and agent-created drafts use compatible line and selection representations.
  Save and finalization reject stale invoice edits without overwriting newer
  state. Finalization revalidates complete source history and applies the existing
  replay-safe billing operation exactly once; deleting a draft cannot delete an
  invoice that was finalized while its confirmation was open.
- Finalization rejects stale drafts when selected work leaves the invoiced
  project, changes its source-client context, or becomes non-billable. Explicit
  agent invoice-recipient selection remains supported when the captured source
  relationship is unchanged.
- Moving billed work retains finalized invoice client/project attribution,
  source claims, rates, durations, and task billing metadata. Unbilled work
  follows the destination; eligible cancellation releases original claims by
  identity without restoring the task's previous project. Invoice previews and
  selectors resolve complete legacy merged-task evidence before project filters.
- Finalization snapshots billing/currency/branding data and applies source billing state once.
- Payments record their financial context. **Mark as unpaid** is a confirmed correction for a mistakenly recorded payment: it removes `paidAt` and the payment-currency snapshot, preserves the finalized invoice and its billing-source claims, and returns the invoice to effective Outstanding or Overdue. It does not record or issue a refund.
- Undo latest invoice uses stored billing snapshots to restore eligible source records safely.
- Cancellation is a terminal, void-like workflow for finalized unpaid invoices whose effective status is sent or overdue. It preserves the invoice, number, original totals, immutable snapshots, sent metadata, and project links while releasing only billing sources still owned by that invoice.
- Cancellation requires a trimmed reason of 1–500 characters and exact invoice-number confirmation. It is journaled, retry-safe, and shared by the browser and agent surfaces.
- Canceled invoices remain available as immutable audit records but are non-payable, non-emailable, excluded from financial/report totals, and unmistakably marked in retained PDF output. Their numbers remain permanently consumed.
- Quote preview/export/email operates in quote mode and does not claim work as billed.
- Invoice, reminder, and quote email flows reject generated attachments that lack the PDF signature or a final PDF end-of-file marker. Validation runs in memory before browser upload and again at the Worker boundary; attachment bytes are not persisted by TaskTime Pro.

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
