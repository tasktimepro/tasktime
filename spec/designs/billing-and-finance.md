# Billing And Finance Experience Design

## Goal

Let users understand exactly what will be billed, what changed after finalization, and how payments/undo affect records.

- Invoice creation begins from eligible unbilled work and expenses, then moves through selection and preview before mutation.
- Draft editing keeps line descriptions, quantities, rates, adjustments, tax, branding, payment instructions, and totals visible.
- Finalization is visually distinct from preview/export and explains its billing consequences.
- Payment controls capture date, amount/method, and relevant currency context.
- Expense views provide filters, due/recurrence context, paid state, categories, project/client links, and tax status.
- Reports place filters near affected totals and use tables/exports where comparison matters.

## Billing safety rules

- UI and agent previews load active, historical, and archived billing candidates before selection.
- Entry-level billing markers and immutable selection snapshots are the current allocation evidence. For a finalized legacy invoice without a selection snapshot, markerless source entries are treated as already billed only when its stored billing period and per-task source duration account for all candidates exactly; ambiguous or later-created backdated entries remain eligible.
- A draft/final invoice captures the exact selected entries, task allocations, expense conversions, rates, durations, and quoted amounts. Finalization consumes only that snapshot; later-synced unbilled work stays eligible for a future invoice.
- Archived tasks do not release or hide unbilled work.
- Increasing invoice hours creates a visible invoice-adjustment entry. Reducing hours below selected recorded time is rejected until the user splits or edits the source entries, so no unexplained remainder is silently consumed.
- Drafts cannot be emailed as invoices or marked paid. Quotes remain non-mutating. Sent and paid invoices are immutable in the normal edit flow; corrections use undo where eligible or a later explicit correction workflow.
- Canonical line quantity, rate, amount, subtotal, tax, and total must reconcile with deterministic minor-unit rounding before persistence.

## Time and currency precision policy

- Stored time intervals and timer elapsed values remain millisecond-exact. Timer displays may show seconds and summary displays may show minutes/decimal hours, but display formatting never changes the stored interval.
- Billing uses the exact selected interval unless a configured project billing increment creates an explicit rounded-up `billableDurationMs` snapshot. Raw tracked time is not rewritten.
- Current invoice, expense-conversion, payment, allocation, and report accounting uses deterministic two-decimal precision. Multi-project remainders use a stable largest-remainder allocation so their sum equals the canonical invoice total.
- Exchange rates are USD-relative adapter data cached for up to 24 hours. Finalized invoice selections and paid invoice/expense records preserve the source amount, target amount/currency, and effective rate used at the event; missing required rates fail closed rather than inventing a 1:1 conversion.
- Reports prefer immutable event snapshots for finalized/paid values. Current rates are used only for live values that do not yet have an applicable stored snapshot, with conversion failure surfaced instead of silently changing currencies.

Destructive or reversal actions name the invoice/expense and state their downstream effects. Cancellation is not designed until `spec/ambiguities.md` is resolved.
