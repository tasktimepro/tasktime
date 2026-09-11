# Subscription launch claim inventory

> **State, 2026-09-11:** Local Free/Pro copy reconciliation is complete and
> unpublished. The historical inventory below explains the changes, not open
> implementation work. Phase 4 still owns final legal/commercial approval and
> coordinated publication; no paid plan is represented as deployed.

## Current reviewed copy

- Keep Free first: core use needs no account; tasks, projects, timers, expenses,
  invoices, PDFs and manual delivery remain Free. Pricing/README identify one
  active client and the current-month Reports Overview without recasting Free
  as a trial. Existing client/work history remains usable after Pro ends.
- Getting-started, timer, invoicing and comparison articles no longer deny an
  optional paid plan. Advanced-report guides and their search/social metadata
  identify Pro; Free Overview and separate tax bookkeeping are preserved.
- Hosted-email guidance identifies Pro and the allowance shown in the app,
  not the old 10-send limit or a synthetic quota. Its published section anchor
  remains stable. PDFs/manual delivery remain Free.
- Pricing, Terms, Privacy, agent overview and `llms.txt` use concise optional-Pro
  wording. Terms cover annual renewal, cancellation, no automatic trial charge,
  retained work and mandatory consumer rights without inventing refund terms.
- Both `PRIVACY.md` and site Privacy distinguish local workspace data from
  optional billing identity/plan/usage records, Stripe payment/contact/tax
  processing and minimal hosted-delivery records. They do not claim there is
  no user database or no third-party payment processing.
- Site copy regressions cover retired claims, billing/privacy/discovery, report
  metadata and the preserved email anchor; the full independent site gate passes.

## Remaining Phase 4 decisions

Verify the exact live founding/standard catalog, availability and tax treatment;
approve seller/jurisdiction, refund/dispute/cancellation/Portal behavior, hosted
allowance, grace, retention periods and support ownership. Publish this copy only
with the matching approved app/Worker behavior and delivery-minimization evidence.
Final legal approval is not inferred from local copy tests. The coordinated
checklist remains in `TODO.md`; no new price, quota or legal policy is invented here.

## Historical Phase 1 inventory (2026-08-30)

This is the Slice 0 inventory of active public claims that must be preserved,
clarified, or corrected in the separately approved purchaser-ready release.
Line references identify the 2026-08-30 source snapshot; launch preparation must
re-run the inventory against the final release commit rather than assuming the
numbers remain current.

## Classification rule

- **Preserve:** still true after launch and should not be weakened.
- **Clarify at launch:** substantially true, but must distinguish Free core or
  manual delivery from a hosted Pro action.
- **Correct at launch:** conflicts with the approved two-plan boundary and must
  change in the purchaser-ready copy/legal release, not during local Phase 1.

## Product and legal surfaces

| Source | Current claim | Class | Purchaser-ready treatment |
|---|---|---|---|
| `README.md:8` | TaskTime Pro is free, open source, local first; core use needs no account/cloud and works offline. | Preserve | Keep the complete core-use statement. Add the one-active-client-at-a-time boundary only when enforcement is released. |
| `README.md:21` | Invoices, templates, PDF, payments, quotes, and reports are product capabilities. | Clarify at launch | Preserve invoicing/PDF/manual delivery and Free current-month Overview; identify advanced report tabs/outputs as Pro. |
| `PRIVACY.md:38` | Send Invoice passes PDF/email/recipient content to Resend. | Clarify at launch | Keep the data-flow disclosure and identify it as optional TaskTime-hosted Send; manual PDF delivery remains local/free. |
| `PRIVACY.md:40` | Server audit data uses hashed identifiers/timestamps and does not archive content. | Preserve after cutover | Publish only with private minimization and log-removal evidence; do not overstate the current deployment before that cutover. |
| `PRIVACY.md:88` | Resend is used when invoice email is sent. | Clarify at launch | Scope this to TaskTime-hosted Send and retain the third-party disclosure. |
| `tasktime-site/src/layouts/TermsConditionsDocument.astro:32` | Core use is browser-local and needs no hosted workspace account. | Preserve | Keep unchanged in substance. |
| `tasktime-site/src/layouts/TermsConditionsDocument.astro:56` | Send Invoice uses Resend and its terms/privacy apply. | Clarify at launch | Scope to hosted Send and preserve the review/consent boundary. |
| `tasktime-site/src/layouts/TermsConditionsDocument.astro:76` | Liability may be limited to the amount paid, which may be zero. | Preserve pending legal approval | Final seller/jurisdiction review owns wording; the statement is compatible with Free plus optional Pro. |
| `tasktime-site/src/layouts/TermsConditionsDocument.astro:86` | Paid plans may be introduced in the future. | Correct at launch | Replace with approved current recurring-plan, renewal, cancellation, refund, tax, and Portal terms only in the legal/purchaser release. |

## Active discovery and article surfaces

| Source | Current claim | Class | Purchaser-ready treatment |
|---|---|---|---|
| `tasktime-site/src/content/blog/getting-started-with-tasktime.md:24` | No account/server/cloud is required for local records. | Preserve | Keep as a core-use claim; optional provider identity is only for sync/hosted services. |
| `tasktime-site/src/content/blog/getting-started-with-tasktime.md:55` | Generate a PDF and “send it off.” | Clarify at launch | Make clear that PDF/manual delivery stays Free while TaskTime-hosted Send is Pro. |
| `tasktime-site/src/content/blog/free-task-timer-for-freelancers.md:2-12,16-27` | The timer is genuinely free/no account and should not cap tasks/projects. | Preserve | Tasks, projects, timers, and entries remain unlimited; do not recast core use as a trial. |
| `tasktime-site/src/content/blog/free-task-timer-for-freelancers.md:45` | There is no paid tier; the whole app is free. | Correct at launch | Preserve the explicit unlimited projects/tasks/timers/entries claim, but replace the no-paid-tier sentence with truthful Free/Pro packaging. |
| `tasktime-site/src/content/blog/free-invoicing-tool-for-freelancers.md:2-12` | Free invoicing has no subscription/paywall. | Clarify at launch | Preserve unlimited invoice creation, PDF, payment tracking, and manual delivery; remove the implication that no optional subscription exists. |
| `tasktime-site/src/content/blog/free-invoicing-tool-for-freelancers.md:45` | Invoicing itself is free and browser-local without a paid hosted workspace. | Preserve | Keep; hosted Pro does not own invoice records or the workspace. |
| `tasktime-site/src/content/blog/free-invoicing-tool-for-freelancers.md:49-51` | No paid version exists and every feature is available from the start. | Correct at launch | Replace only the contradictory no-gate language; retain the Free invoicing boundary. |
| `tasktime-site/src/content/blog/send-invoices-by-email-from-tasktime.md:2-63` | TaskTime can prepare and directly send editable invoice/reminder email through Resend using either provider session. | Clarify at launch | Preserve preparation/template/PDF/provider-neutral authentication; identify hosted Send as Pro and manual delivery as Free. |
| `tasktime-site/src/content/blog/send-invoices-by-email-from-tasktime.md:75-77` | Hosted sending has a 10-email limit and no paid tier can unlock more. | Correct at launch | Replace with the approved live Pro UTC-month allowance only after it is decided and configured; never publish the synthetic test allowance. |
| `tasktime-site/src/content/blog/monthly-freelance-reports-dashboard-tasktime.md:2-165` | Advanced monthly Reports expose filters, profit/tax/hours/uninvoiced analysis and outputs. | Correct at launch | Preserve the capabilities as Pro previews/benefits; state that Free retains only current-local-month Received, Expenses, and Tracked time plus separate tax bookkeeping. |

## Release rule

The purchaser-ready edit must be one reviewed release package across current
landing/discovery pages, these articles, Privacy, Terms, agent descriptions, and
generated catalogs. Historical articles may receive an explicit dated note if
editorial policy prefers that over silent rewriting. No copy may advertise the
founding/standard purchase path until both paths work, and no copy may publish a
live allowance, grace period, tax presentation, seller promise, or support SLA
before its decision-packet evidence is approved.
