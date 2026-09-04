# Billing And Finance Experience Design

## Goal

Let users understand exactly what will be billed, what changed after finalization, and how payments/undo affect records.

- Invoice creation begins from eligible unbilled work and expenses, then moves through selection and preview before mutation.
- Draft editing keeps line descriptions, quantities, rates, adjustments, tax, branding, payment instructions, and totals visible.
- Finalization is visually distinct from preview/export and explains its billing consequences.
- Payment controls capture date, amount/method, and relevant currency context.
- Expense views provide filters, due/recurrence context, paid state, categories, project/client links, and tax status.
- Reports place filters near affected totals and use tables/exports where comparison matters.

## Locally implemented Free to Pro experience (production-disabled)

- Reports stays neutral in desktop/mobile navigation. Its Free Overview shows
  only current-month **Received**, **Expenses**, and **Tracked time**; every
  advanced tab remains visible in the established single-row, horizontally
  scrollable tab layout. Selecting a gated tab shows a tailored static Pro
  preview before any protected data loads; the tabs do not repeat Pro badges.
- Invoice/quote email composition, templates, forwarding choice, PDF preview/
  download, copying, and manual delivery remain usable. Only the final TaskTime-
  hosted **Send** action becomes the Pro conversion point. It stays visible but
  unavailable with an inline explanation and a separate enabled trial/Pro or
  recovery action; a disabled control is never the only path forward. Trial/
  purchase return restores the draft and always requires a fresh Send.
- Modal upgrade explanations use the neutral notice treatment rather than a
  warning state. Their primary upgrade action is the last, right-aligned footer
  action and uses a rocket icon; account-status recovery remains distinct and
  uses its cloud action instead.
- Plan & Billing reuses the visible sync lifecycle when a Pro action needs a
  cloud identity: a returning user sees reassuring reconnect copy rather than
  first-time setup instructions. Setup and reconnect notices stay neutral and
  use the primary icon-labelled cloud action so it remains clear on the muted
  notice background.
- Plan & Billing uses the same side-by-side Free/Pro comparison in disconnected,
  Free, trial, paid, grace, suspended, and recovery states. A neutral **Current
  plan** badge sits beside the verified Free or Pro card title; unresolved state
  shows no guessed badge. Trial, Checkout, billing management, and recovery are
  contextual actions inside the Pro card. **Manage billing** is limited to a
  verified subscription-backed Pro state; a Stripe customer record alone does
  not add it to Free, trial, or grant states. Hosted-email allowance is enforced
  and explained at the Send action rather than through a separate account card.
  The one-time trial names the connected provider email beside **Start free
  trial**, falling back to neutral connected-provider copy when an email is
  unavailable. Copy ties eligibility to the connected TaskTime cloud account and
  explains that it stays with that account after reconnect or verified provider
  transfer. The stable TaskTime account reference remains
  internal and is never used as the customer-facing identity; selecting the
  action is the explicit confirmation, without a second checkbox.
- Pricing presents only Free and Pro. It labels annual `EUR 39` truthfully as
  the founding base price for the first 250 paid members and annual `EUR 59`
  as the automatic standard offer afterward. Temporary reservation saturation
  shows a retry state rather than switching early. Amount, tax, applicability,
  and availability derive from the versioned catalog/status projection; a price
  change always returns to an explicit order confirmation. Plan & Billing marks
  the founding amount with an asterisk and keeps its first-250 capacity and
  same-subscription retention terms directly below the displayed price; the
  standard amount has no founding footnote. The action footer keeps trial on
  the left and the rocket-led Get Pro action on the right, replaces the rocket
  with the shared loading spinner while Checkout opens, and places the
  right-aligned tax qualifier below the actions only while Get Pro is present.
  Manage billing uses the same loading treatment while the Stripe Portal opens;
  a completed purchase never leaves Checkout tax copy on the Pro card. Hosted
  Checkout owns the final recurring-subscription disclosure and confirmation.
  The explicit purchase action passes the locally verified connected-account
  email as an optional billing contact so Stripe can prefill it; this contact
  never becomes account, trial, or entitlement identity. Checkout keeps automatic tax and business
  tax-ID support, lets Stripe collect only the location detail it needs, and does
  not force a full-address form or separate TaskTime Terms checkbox.
- Cancellation defaults to period end and shows continued access plus the exact
  end date in a neutral **Subscription set to end** notice; it never describes
  the end as "soon." Returning from the Stripe Portal waits for the selected
  provider's foreground reconnection to settle before triggering canonical
  Stripe reconciliation. The exact-bound signed device assertion keeps the
  known Free or Pro plan selected throughout this period and while offline;
  transport readiness gates the Portal/Checkout/status calls, not the local plan
  display or offline entitlement. A transient return failure clears and retries when
  canonical status recovers instead of remaining until navigation, and online
  service/session failures are not labelled as browser offline. The subscription
  webhook remains the source-of-truth fallback if the user closes the Portal or
  does not return. A founder's
  confirmation explains that reversing before then
  preserves the founding base price, while terminal cancellation permanently
  ends founding eligibility and a later new subscription uses the current
  standard offer (`EUR 59/year` under the approved launch catalog). A standard
  subscriber sees no founding-language warning and is told that a later new
  subscription uses the then-current standard catalog.

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

## Payment correction experience

- A paid invoice's three-dot action menu exposes **Mark as unpaid** as an explicitly confirmed correction for a mistakenly recorded payment.
- The confirmation explains that the recorded payment date and currency-conversion snapshot will be removed, the invoice remains finalized, and its billed time and expenses stay linked. It states plainly that the action does not record or issue a refund.
- The confirmation cannot be dismissed or submitted twice while saving. On failure it remains open with a visible error; on success it selects the invoice's effective Outstanding or Overdue bucket.

## Cancellation experience

- **Cancel invoice** is available only for sent or overdue unpaid invoices. Drafts remain editable/deletable. A mistakenly recorded payment can first be corrected with **Mark as unpaid**; an actually settled invoice requires a future credit-note/refund workflow and must not use that correction as a refund substitute.
- The confirmation names the invoice, client, date, currency, and total; explains source release, financial-report exclusion, record retention, and permanent number consumption; requires a 1–500 character reason plus the exact invoice number; and prevents duplicate submission or dismissal while committing.
- Successful cancellation selects the mutually exclusive Canceled tab and retains a read-only invoice with its original face value and cancellation metadata. Because the bucket and existing card metadata already communicate status and total, the list card uses only a compact neutral cancellation-reason notice; preview and export remain explicitly marked canceled. The success result reports released-source counts without implying a refund, customer notification, credit note, or tax filing adjustment.
- Canceled records expose only safe preview/download actions. Every document is visibly marked CANCELED; edit, finalize, payment, sent/unpaid transitions, undo, invoice/reminder email, repeated cancel, and uncancel are unavailable.

Destructive or reversal actions name the invoice/expense and state their downstream effects. Cancellation is terminal, explicit, offline-capable, and separate from delete-draft, undo-latest, mark-unpaid, refunds, and credit notes.
