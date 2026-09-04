# App Status

## Current focus

- [x] Implement the Program Phase 1 subscription client locally with every
  production build control false: lifecycle-bound ES256 cache/status, Account
  billing shadow UI and Checkout-return recovery, forward-only one-active-client
  policy, current-month Free Reports Overview/static advanced previews, and
  hosted-email attempt recovery. Modal upgrade prompts are neutral and keep
  their icon-labelled primary action last in the standard right-aligned footer.
  No production feature is enabled or deployed.
- [x] Replace the synthetic billing-state preview with an explicit loopback-only
  pre-production sandbox. The app now uses the normal local Worker-backed
  catalog/status/license/trial/Stripe test Checkout/webhook/reconciliation/Portal
  flow, disables the bundled catalog fallback, waits for a matching connected
  cloud lifecycle before consuming a Checkout return, and exercises hosted Send
  plus delivery-status through the normal Pro entitlement, local quota,
  idempotency, recovery, and configured Resend path without adding sandbox-only
  banners or developer-facing notices to product screens. The local Worker has
  exact localhost return validation, ignored mode-0600 secret/signing material
  preparation, repeatable local D1 migrations and rollout approvals, and a
  bounded Stripe webhook listener command. Production controls/configuration
  remain unchanged and off.
- [x] Collapse the recurring billing-sandbox workflow into the default root
  `make dev` entrypoint. In the operator checkout it prepares local
  configuration/D1 and starts the app, Worker, and Dockerized Stripe webhook
  listener as one attached Compose stack with shared shutdown; an expired Stripe
  test login or missing ignored service credential is reported before startup.
  Lower-level private commands remain for diagnosis rather than normal use.
  Multi-profile Stripe CLI discovery validates
  the exact TaskTime Price instead of assuming `[default]`; attached logs redact
  the local webhook secret, and normal startup installs Worker dependencies once.
  `make dev-billing-sandbox` remains a compatibility alias and `make dev-core`
  retains an isolated public/diagnostic fallback. A local parity regression
  prevents the overlay from disabling production-enabled Worker controls, and
  preparation rejects a missing Resend credential before the UI can encounter a
  hosted-email 503. The attached services run in a dedicated Compose project so
  one-off Docker validation cannot join their lifecycle and stop the stack. The
  same preparation now applies the existing idempotent local Web Push schema
  before the shared scheduled sidecar starts, preventing an empty Push D1 from
  reporting a failure while billing/email recovery succeeds.
- [x] Recover a lifecycle-bound browser email marker whose earlier request was
  rejected before the Worker created a durable attempt. An authenticated
  `ATTEMPT_NOT_FOUND` marks only that local marker rejected and silently restores
  the explicit Send action. Existing attempts and entitled-send `5xx` responses
  are checked automatically, with bounded polling while the modal remains open
  and no manual status button. A genuinely unknown delivery stays visible and
  blocked from duplicate Send; checking never sends, replays, clears unrelated
  attempts, or treats other 404s as safe recovery. Completed and terminal-partial
  markers are also rediscovered when a crash leaves the unchanged invoice
  without its Yjs sent timestamp. Owned status proof reapplies the accepted
  customer delivery once, removes Send, preserves any forward-copy warning, and
  already-sent invoices stop polling.
- [x] Keep the public Free/Pro catalog visible in Plan & Billing before cloud
  setup, defer the Google Drive or Dropbox prerequisite to trial and purchase
  actions with nearby guidance, and distinguish missing cloud identity from a
  previous Cloud Sync connection that only needs reconnecting or a connected
  account whose billing status needs refreshing. Setup/reconnect guidance stays
  neutral and uses the primary icon-labelled action. No billing mutation
  starts before canonical provider-bound status is available. The same Free/Pro
  cards now remain visible after status loads, mark only the verified active
  card as **Current plan**, and contain trial, purchase, Portal, and recovery
  actions without a separate hosted-email usage card. The one-time trial names
  the connected provider email beside its action and uses neutral provider copy
  until that email is available, ties eligibility to the connected TaskTime cloud
  account, and explains that reconnect or verified provider transfer preserves
  it; the stable TaskTime reference stays internal.
  **Start free trial** itself provides the explicit confirmation without a redundant checkbox. Loopback
  review now renders the same bundled values as `/pricing/` immediately, without a
  blocking loading notice. The founding amount is footnoted as limited to the
  first 250 paid members, while exhausted status displays the unstarred
  standard offer; production catalog authority remains Worker-only.
- [x] Refine the Plan & Billing purchase footer and Dropbox identity fallback.
  Start trial remains on the left; the rocket-led Get Pro action and the
  tax qualifier align right, with the shared loading spinner shown while
  Checkout opens. The qualifier disappears with Get Pro after purchase, and
  **Manage billing** uses the same spinner while Stripe Portal navigation is
  opening. Renewal disclosure remains in hosted Checkout. **Manage billing**
  appears only for verified subscription-backed Pro, even when an
  otherwise-Free account retains a Stripe customer record. Dropbox shows the
  connected email when available and stays quiet for a legacy session without
  one instead of prompting for identity-only reconnection. An expired prior
  Checkout is now retired and retried once from the same explicit Get Pro click
  when the offer remains unchanged; changed offers still require reconfirmation,
  and failed actions never expose internal billing codes.
- [x] Reconcile Stripe Portal returns before presenting subscription changes.
  The fixed return marker triggers a canonical Stripe refresh but is never
  treated as cancellation proof; webhook and scheduled reconciliation remain
  authoritative fallbacks. A verified period-end cancellation displays the
  neutral **Subscription set to end** notice with its effective date and confirms
  continued Pro access without describing the end as "soon." Return handling now
  preserves the exact-bound signed device plan while the selected provider
  reconnects, gates only online status/Stripe work on connection readiness,
  retries a transient failure after canonical status recovery without a tab
  change, and reserves the **You are offline** notice for a browser-reported
  offline state. A known Pro browser never falls back to trial or **Get Pro**
  presentation during that reconnect.
- [x] Correct the local Stripe Checkout redirect boundary after the real hosted
  URL exposed opaque fragment state. The browser and Worker now preserve that
  fragment only for the exact credential-free HTTPS Stripe Checkout host, with
  red/green contract coverage. A provider-authenticated browser proof reached
  Stripe test Checkout without entering payment details or completing a
  purchase; Checkout return, webhook, and subscription convergence remain
  separate owner-entered evidence.
- [x] Simplify hosted Checkout after the first browser review. The explicit Get
  Pro action passes the locally verified provider email as optional billing
  contact data only, prefilling new and email-less mapped Stripe Customers while
  preserving an existing Stripe billing email. Checkout keeps automatic tax,
  business tax-ID support, and address/name propagation but no longer forces a
  full billing address or separate TaskTime Terms checkbox. Old clients may omit
  the additive field, and email remains non-authoritative for account, trial,
  transfer, or entitlement decisions. Final production tax and consent approval
  remains open. The final complete candidate evidence is recorded below.
- [x] Pass the local subscription candidate gates. The pre-production sandbox
  candidate now passes 259 app files / 2,437 tests, coverage, lint, repository
  typecheck, 39 Chromium smokes, four PWA smokes, and the 50-page merged
  production app/site build. The finalized private Worker candidate passes 33
  files / 307 tests, Worker typecheck, both migration verifiers, and strict
  current-schema attestation. A fresh authenticated multi-profile
  startup selected the TaskTime account by exact Price, reached the attached
  app/healthy Worker/listener stack, and shut down cleanly with `Ctrl+C`. The earlier
  bounded Stripe lifecycle rehearsal remains separate evidence. A later
  owner-entered browser Checkout completed in Stripe test mode; the scheduled
  reconciler recovered its missed local event, terminalized the attempt and
  founding slot, and the app rendered subscription-backed Pro. A repeated
  scheduler pass made no additional database change.
  The separately recorded real Stripe test-mode lifecycle rehearsal also passed,
  closing Program Phase 1 locally;
  this remains distinct from production deployment or release approval.
- [x] Prepare core app `1.4.1`: correct invoice custom/preset billing ranges so the full local end date is eligible in browser and agent composition, preserve historical snapshot-less invoice matching, and normalize exported custom-report timestamps to inclusive day boundaries. No agent artifact, backup schema, or Worker release is required.
- [x] Make direct Drive sync more responsive without weakening mode boundaries: Backup and Sync modes debounce note edits for 1.5 seconds, pending local work retries with bounded backoff after active-sync/Web Lock contention, Sync mode checks every five minutes only while visible, and Manual mode remains explicit-only.
- [x] Retire the Drive data proxy and temporary staging environment. Active Worker version `37` serves direct Drive control-plane sessions only, denies old `/drive/*` browser preflight without CORS permission, and permits the exact local production-preview origin. The isolated staging Worker, KV namespace, D1 databases, secret file, config, tests, and runbook are removed. Current privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy state the direct browser-to-Google Drive boundary.
- [x] Complete the provider-neutral cloud-sync and Dropbox production rollout for approved/current accounts recorded in `status/cloud-sync-provider-expansion.md`. Google Drive and Dropbox now share the direct browser-to-provider data plane, active-provider hosted identity, backup and destructive lifecycles, and explicit transfer flow. The promoted moved-source recovery offers the recorded destination first and permits source reuse only through verified source-only deletion plus a complete push-only seed. The existing production Google Drive session survived the upgrade and returned to In sync; transfer initialization and UI exposure are live, while full two-provider move coverage comes from the real-account local production-preview canaries. Broad new-user Dropbox availability remains gated on App Console production access followed by the non-destructive post-approval sign-in/token/direct-file canary.
- [x] Align connected-account presentation across providers. New/reconnected
  Dropbox grants add only `account_info.read`; the browser reads the verified
  email directly from Dropbox and keeps it in the local auth record, while the
  Worker retains only its pseudonymous subject. Cloud Sync and Plan & Billing
  show the provider email when available and neutral connected-provider copy
  otherwise; the stable `TT-…` reference remains an internal/support contract
  and is never the customer-facing identity. Existing file-scope-only Dropbox
  sessions stay valid and can reconnect explicitly to add the email. Final
  focused billing/Dropbox-auth coverage passes 38 tests; the completed broader
  gate passes 2,344 app tests, 177 Worker tests, lint, both typechecks, and the
  merged app/site build. Local browser review confirms the legacy Dropbox
  connection shows neutral identity copy in Cloud Sync and Plan & Billing.
- [x] Refine provider-transfer hierarchy: show the selected provider's official mark beside its lifecycle-driven title, place transient transfer state first, and expose durable-stage determinate progress with accessible semantics.
- [x] Replace provider-transfer storage jargon with provider-specific plain language and a compact warning that distinguishes closing TaskTime on other devices from disconnecting their authorization.
- [x] Simplify the transfer warning to one title-free instruction and add the destination provider mark to the Connect & transfer action.
- [x] Make transfer progress truthful and transient: hold at zero until the first durable stage, animate a reduced-motion-safe traveling highlight inside the filled line during work, and remove the panel once the success toast and switched provider card take over.
- [x] Make Dropbox a default-on client capability, retain only an explicit false emergency UI opt-out, and make onboarding provider-neutral while preserving truthful Drive-only fallback copy for that opt-out.
- [x] Complete all six invoice-cancellation slices: terminal retained records, replay-safe source release, Canceled UI/PDF safety, zero-contribution financial reporting, agent parity, and backup `1.5` compatibility.
- [x] Expose the existing paid-invoice correction in the browser three-dot menu with explicit confirmation, paid-only eligibility, refund-safe wording, payment-detail clearing, preserved billing-source claims, and Outstanding/Overdue routing.
- [x] Complete pre-ship hardening for cancellation commit races, persisted-plan field constraints, late-arriving owned claims, protected later billing, and theme-aware canceled-state UI tokens.
- [x] Release the completed cancellation scope as `v1.2.0`: core app `1.2.0`, backup contract `1.5`, agent bridge/MCP and OpenClaw/Claude bundles `0.3.0`, ClawHub skill `1.1.0`, and Claude marketplace `1.1.0`; no private Worker change was required.
- [x] Cross-validate critical persistence and billing specifications against implementation and historical fixtures.
- [x] Complete the dependency-ordered remediation and release checklist in `status/critical-path-assurance.md`.
- [ ] Continue gradual TypeScript migration without breaking stable imports or persisted contracts.
- [x] Establish a zero-diagnostic repository-wide TypeScript baseline and enforce it in the release gate.
- [ ] Improve testing infrastructure while preserving the per-file coverage gate for hooks and utilities.
- [x] Centralize timer lifecycle/recovery, manual time-entry protection, recurring task state, and relationship-bearing work-entity writes across UI and agent surfaces.
- [x] Fail closed on duplicate entity creates, protect billed/tax-claimed expense deletion, and commit paid cross-currency expense mutations only after snapshot preparation.
- [x] Align individual dashboard time-entry and Hours-report total/billable durations with the seconds-aware task display so sub-minute work never appears as `0m`.

## Production baseline

- [x] Yjs multi-document storage and IndexedDB persistence
- [x] Manual, backup, and bidirectional Drive sync modes
- [x] Projects, clients, tasks/subtasks, timers, time entries, planner, goals, and notes
- [x] Expenses, recurrences, tax periods, invoices, quotes, payments, reports, and export/import
- [x] Responsive PWA shell, offline indicator, service worker, and mobile navigation

The July 2026 critical-path assurance phase supplies deeper edge-case, historical-compatibility, failure-injection, browser, PWA, and live-agent evidence for this baseline.
