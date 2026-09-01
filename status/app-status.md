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
  cloud lifecycle before consuming a Checkout return, and keeps hosted Send plus
  delivery-status checks disabled. The local Worker has exact localhost return
  validation, ignored mode-0600 secret/signing material preparation, repeatable
  local D1 migrations and rollout approvals, and a bounded Stripe webhook
  listener command. Production controls/configuration remain unchanged and off.
- [x] Collapse the recurring billing-sandbox workflow into the single root
  `make dev-billing-sandbox` entrypoint. It prepares local configuration/D1 and
  starts the app, Worker, and Dockerized Stripe webhook listener as one attached
  Compose stack with shared shutdown; an expired Stripe test login is the only
  occasional external prerequisite. Lower-level private commands remain for
  diagnosis rather than normal use. Multi-profile Stripe CLI discovery validates
  the exact TaskTime Price instead of assuming `[default]`; attached logs redact
  the local webhook secret, and normal startup installs Worker dependencies once.
- [x] Keep the public Free/Pro catalog visible in Plan & Billing before cloud
  setup, defer the Google Drive or Dropbox prerequisite to trial and purchase
  actions with nearby guidance, and distinguish missing cloud identity from a
  connected account whose billing status needs refreshing. No billing mutation
  starts before canonical provider-bound status is available. Loopback review
  now renders the same bundled values as `/pricing/` immediately, without a
  blocking loading notice. The founding amount is footnoted as limited to the
  first 1,000 paid members, while exhausted status displays the unstarred
  standard offer; production catalog authority remains Worker-only.
- [x] Pass the local subscription candidate gates. The pre-production sandbox
  update passes 259 app files / 2,329 tests, lint, repository typecheck, merged
  50-page build, and the private Worker test/typecheck gates. The finalized
  sandbox orchestration passes 27 Worker files / 177 tests, Worker typecheck,
  and its focused public workflow test. A fresh authenticated multi-profile
  startup selected the TaskTime account by exact Price, reached the attached
  app/healthy Worker/listener stack, and shut down cleanly with `Ctrl+C`. The earlier
  bounded Stripe lifecycle rehearsal remains separate evidence; the next manual
  browser Checkout now requires only owner-entered test card/customer values.
  The prior broader gate had
  260 files / 2,332 tests with coverage thresholds, lint/typecheck, 39 Chromium
  smokes, four PWA smokes, and
  the 49-page merged app/site build. The separately recorded real Stripe
  test-mode lifecycle rehearsal also passed, closing Program Phase 1 locally;
  this remains distinct from production deployment or release approval.
- [x] Prepare core app `1.4.1`: correct invoice custom/preset billing ranges so the full local end date is eligible in browser and agent composition, preserve historical snapshot-less invoice matching, and normalize exported custom-report timestamps to inclusive day boundaries. No agent artifact, backup schema, or Worker release is required.
- [x] Make direct Drive sync more responsive without weakening mode boundaries: Backup and Sync modes debounce note edits for 1.5 seconds, pending local work retries with bounded backoff after active-sync/Web Lock contention, Sync mode checks every five minutes only while visible, and Manual mode remains explicit-only.
- [x] Retire the Drive data proxy and temporary staging environment. Active Worker version `37` serves direct Drive control-plane sessions only, denies old `/drive/*` browser preflight without CORS permission, and permits the exact local production-preview origin. The isolated staging Worker, KV namespace, D1 databases, secret file, config, tests, and runbook are removed. Current privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy state the direct browser-to-Google Drive boundary.
- [x] Complete the provider-neutral cloud-sync and Dropbox production rollout for approved/current accounts recorded in `status/cloud-sync-provider-expansion.md`. Google Drive and Dropbox now share the direct browser-to-provider data plane, active-provider hosted identity, backup and destructive lifecycles, and explicit transfer flow. The promoted moved-source recovery offers the recorded destination first and permits source reuse only through verified source-only deletion plus a complete push-only seed. The existing production Google Drive session survived the upgrade and returned to In sync; transfer initialization and UI exposure are live, while full two-provider move coverage comes from the real-account local production-preview canaries. Broad new-user Dropbox availability remains gated on App Console production access followed by the non-destructive post-approval sign-in/token/direct-file canary.
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
