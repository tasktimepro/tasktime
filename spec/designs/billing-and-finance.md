# Billing And Finance Experience Design

## Goal

Let users understand exactly what will be billed, what changed after finalization, and how payments/undo affect records.

- Invoice creation begins from eligible unbilled work and expenses, then moves through selection and preview before mutation.
- Draft editing keeps line descriptions, quantities, rates, adjustments, tax, branding, payment instructions, and totals visible.
- Finalization is visually distinct from preview/export and explains its billing consequences.
- Payment controls capture date, amount/method, and relevant currency context.
- Expense views provide filters, due/recurrence context, paid state, categories, project/client links, and tax status.
- Reports place filters near affected totals and use tables/exports where comparison matters.

Destructive or reversal actions name the invoice/expense and state their downstream effects. Cancellation is not designed until `spec/ambiguities.md` is resolved.
