# TaskTime Pro System Overview

TaskTime Pro is a production, local-first task management, time tracking, expense, reporting, and invoicing application for freelancers and solo professionals. The browser owns user data and business mutations. Optional services add provider-neutral Google Drive or Dropbox cloud synchronization, push notifications, diagnostics, public documentation, and same-device agent access.

This is a context-compression document. Detailed requirements live in `spec/`, durable interfaces in `contracts/`, and mandatory constraints in `rules/`.

## Runtime components

- **Browser app:** React 19/Vite PWA under `src/`. It provides all product screens and owns Yjs-backed mutations.
- **Local persistence:** Yjs documents persisted to IndexedDB through `y-indexeddb`.
- **Cloud sync:** Production supports direct browser-to-Google Drive and direct browser-to-Dropbox App Folder sync with short-lived memory-only access tokens. The provider-neutral lifecycle shares sync, manifest, backup, hosted-service identity, agent behavior, and explicit user-initiated transfer while Worker controls fail closed independently for endpoints, new Dropbox connections, and transfers. Connections and transfers are deployed/enabled for approved/current accounts; no transfer starts automatically. Broad Dropbox availability to new public users remains gated on Dropbox App Console production access followed by the non-destructive post-approval sign-in/token/direct-file canary. Routine file bodies bypass the Worker. Dropbox's verified connected-account email is read browser-to-provider and retained in the origin-local auth record; the Worker keeps its pseudonymous subject for identity and entitlement. Only when the user explicitly starts paid Checkout may the browser submit that verified email as a separate billing contact for the mapped Stripe Customer. A verified moved-source marker stops automatic reconnects, primarily directs the user to the recorded destination, and permits source reuse only through an explicit source-only wipe followed by a push-only seed from the complete local workspace.
- **Agent command layer:** `src/agent/commands/` exposes validated business actions over the browser bridge context.
- **Local MCP bridge:** `src/agent/bridge/` and the built `@tasktimepro/agent-bridge` package provide loopback-only, explicitly paired agent access.
- **Managed OpenClaw plugin:** the official native plugin registers generated TaskTime tools and owns one packaged bridge child for the supervised Gateway/profile lifetime; it does not own product data or duplicate command behavior.
- **Public site:** Astro content under `blog/` builds the product overview, local-review pricing comparison, blog, legal pages, agent documentation, discovery metadata, and generated tool references. The pricing route uses the approved Free/Pro boundary but remains unpublished until the subscription launch gates are approved.
- **Operational evidence:** DebugBundle captures opted-in runtime incident evidence; local tests remain the first tool for deterministic failures.
- **Locally implemented subscription control plane:** Private Worker/D1/Stripe
  modules and the browser client now implement a sanitized catalog, canonical
  provider-bound billing status, short-lived signed local assertions, recovery,
  and action policy under guarded local plus bounded real Stripe test-mode
  evidence. Program Phase 1 is complete locally. Production controls remain off
  until the documented launch gates; no remote billing migration or live
  Stripe/deployment evidence is claimed, and billing state never becomes
  Yjs/product/provider data.
- **Production-like local stack:** In an operator checkout, the default
  `make dev` command applies an explicit Vite-development flag on a loopback
  hostname and runs the app, local Worker/D1, scheduled recovery runner, and
  Dockerized Stripe test webhook listener as one attached Compose stack under a
  dedicated Compose project, so
  one-off Docker validation commands cannot join its lifecycle or stop it. The
  local overlay cannot turn off a
  Worker control enabled in tracked production configuration, while guarded
  unreleased billing controls may be enabled against Stripe test mode. Product
  screens remain visually production-like without sandbox-only
  banners or developer-facing notices. Hosted Send and email delivery-status
  checks exercise the normal Pro entitlement, quota, idempotency, and recovery
  path against local D1 and the configured Resend account; startup fails before
  opening the stack if that ignored local credential is absent, and delivery
  still requires an explicit Send. `make dev-billing-sandbox` remains a compatible
  alias, while a public checkout without private infrastructure retains an
  explicit core-app fallback. Production builds ignore the sandbox flag, and
  product data remains in the ordinary real local Yjs workspace with its
  configured sync mode. The Vite development server does not install the
  production service worker; PWA caching and Web Push use the production-preview
  validation path. Startup read-only attests the applied local email ledger
  against the canonical schema after migrations and fails closed on drift; it
  never repairs or deletes preserved local data automatically. Before the
  scheduled sidecar starts, preparation also applies the existing idempotent Web
  Push schema to its isolated local database so an empty developer checkout does
  not make the otherwise-independent recovery invocation fail.
- **Hosted-email recovery:** The browser persists a privacy-minimized,
  lifecycle-bound attempt before Send. A single byte-identical retry reuses the
  same attempt and provider idempotency key; all later browser reconciliation is
  D1-only and provider-free. Status may use bounded, privacy-minimized
  coordination evidence to make a definitive missing-attempt result safe, but it
  never changes an attempt, quota, or delivery outcome. Signed provider events
  and the scheduled Worker reconciler may confirm an already-contacted part but
  never resend it. An authenticated
  `ATTEMPT_NOT_FOUND` releases only the exact local marker because no durable
  Worker reservation exists. Reconciliation runs automatically on discovery and
  after an entitled-send `5xx`; the modal stops loading after a short bounded
  check while the list continues background recovery and suppresses duplicate
  Send. Accepted metadata is written once only if the current document still
  matches its send-time snapshot. If the provider result was marked applied but
  the matching Yjs sent timestamp did not survive a crash or reload, the missing
  timestamp opts that retained terminal marker back into owned, no-send status
  proof and idempotent metadata application. This also covers a terminal partial
  result where the customer copy was accepted and an optional forward copy was
  rejected. An invoice that already has sent metadata does not poll again. There
  is no manual status button.
- **Local pricing review fallback:** Vite development on a loopback hostname can
  render the bundled `/pricing/` review catalog immediately inside Plan & Billing
  while the Worker catalog is unavailable. The Worker response replaces it when
  available; production builds never use the fallback, and no fallback value can
  authorize trial, Checkout, entitlement, or hosted service work.

## Data model and ownership

The Yjs store is split into documents so current work stays loaded and historical data can load on demand:

| Document | Responsibility |
|---|---|
| `core` | Projects, active tasks, clients, settings/templates, current invoices, and the internal replay-safe invoice billing-operation journal |
| `entries-active` | Recent time entries |
| `entries-{year}` | Historical time entries by year |
| `tasks-archived` | Archived tasks |
| `expenses-archived` | Archived expenses |
| `invoices-archived` | Archived/older invoices |

`src/stores/yjs/types.ts` defines current TypeScript shapes and `src/stores/yjs/validation.ts` validates current and supported historical data. Existing IndexedDB, Drive, and backup data are live customer contracts.

## Main user flows

1. Create clients and projects, organize tasks/subtasks, and plan work by week.
2. Start, pause, resume, and stop one timer per project; stopping creates one time entry.
3. Record expenses and recurrences, organize tax-return periods, and track paid/claimed states.
4. Generate invoice drafts or quotes from unbilled work and expenses, finalize them, record payments, cancel finalized unpaid invoices as retained audit records, export/send valid documents, and undo supported billing operations.
5. Review dashboard metrics and reports, then export CSV, PDF, ZIP, backup, or accountant artifacts.
6. Optionally connect Google Drive or Dropbox using manual, backup, or bidirectional sync modes.
7. Optionally pair a same-device agent bridge and grant scoped business-action access.
8. The locally implemented, production-disabled Pro release boundary gives Free one active client and a
   useful Reports Overview for the current local calendar month. An optional
   no-card trial or Pro subscription unlocks unlimited active clients, advanced
   report tabs/outputs, and TaskTime-hosted sending. Existing/imported/synced
   records, manual email delivery, PDFs, tax bookkeeping, sync/backups,
   portability, and core agents remain available. Launch packaging is only Free
   and Pro; the founding Pro offer is `EUR 39/year` for the first 250 paid
   canonical principals, after which new acquisition automatically uses the
   `EUR 59/year` standard offer. Existing continuous/recoverable founding
   subscriptions remain on their founding Price.

## Reliability and security model

- Local data remains usable offline; cloud features are optional.
- Hosted billing actions wait for the lifecycle-selected cloud connection to
  finish its foreground reconnection. Portal-return reconciliation retries after
  canonical status recovery, while browser-offline billing UI derives from the
  browser network state rather than a generic retryable service/session failure.
  The exact origin-local lifecycle continues selecting its bounded signed plan
  during startup, reconnect, and offline use; transport readiness gates network
  work without downgrading or deleting that verified device state.
- Schema changes are additive or explicitly migrated and tested against historical data.
- UI badges, invoice composition, and agent invoice commands share the same read-only eligibility operation. Current billing ranges include the complete selected end date and assign cross-midnight entries by their local start date; finalized legacy invoices with markerless source entries retain conservative historical period matching.
- Browser and agent cancellation adapters share one journaled source-release operation. Cancellation revalidates current eligibility before the first journal write; retains the invoice number, original snapshots, and project links; releases only sources still owned by that invoice across active/historical/archive documents; never rewinds numbering; and conditionally converges late-arriving same-invoice claims after partial failure or stale Drive/archive replay without overwriting later billing.
- Canceled invoices remain read-only audit records in `core`, are unmistakably marked in retained PDFs, and contribute zero to payment, revenue, output-tax, profit, outstanding, aging, statement, and project-allocation calculations. Portable backup `1.5` preserves the record while continuing to import every previously supported backup version.
- Mark-as-unpaid is a paid-invoice correction only: it clears payment evidence while retaining billing-source claims and cannot reopen a sent, overdue, draft, or canceled invoice.
- UI hooks and agent commands share domain operations for timer lifecycle/recovered stops, protected manual time-entry mutations, task completion/recurrence state, duplicate-safe entity identity, protected expense deletion, and relationship-safe project/client/task writes.
- The locally implemented entitlement policy is shared across browser and agent paths but remains production-disabled.
  It gates only a net-increasing active-client create/restore transition,
  advanced Reports/exports, and hosted Send. `/reports`, its current-month
  Overview, and every tab remain visible; a locked advanced tab branches to a
  static section-specific preview before mounting protected modules, history,
  calculations, rows, or export builders. Import/restore/sync never discards or
  auto-archives an over-limit client.
- The guarded loopback development stack exercises the normal provider-bound
  browser policy against local Worker/D1 state, Stripe test mode, and the
  configured email provider. It has no synthetic billing-state selector and the
  product UI is the same as production. Its local assertions, test-mode Stripe
  state, and local D1 rows cannot authorize production or establish deployment
  evidence.
- Automatic recurring-task status reads never clear persisted skip evidence; paid cross-currency expense mutations prepare snapshots before committing; canonical agent unbilled queries load complete local history.
- Sync mode trigger semantics in `AGENTS.md` are durable behavior.
- Sync mode performs a lightweight manifest check every five minutes only while visible, coalesces tab-visible/browser-online signals within one second into one foreground pass, and lets genuine pending local work blocked by an active pass or cross-tab lock retry with bounded backoff after the lock can be released. External lazy-document loads serialize behind an active provider pass; lazy loads owned by that pass defer their manifest commit to the owner so revision-sensitive writes cannot overlap.
- Provider-grant revocation is confirmed before the browser clears its Worker session; transient refresh, rate-limit, provider-status, and revocation failures preserve retryable credentials and runtime state. Google Drive and Dropbox expose the same Disconnect and Wipe data & disconnect flows, and Account sign-out/deletion reuse the active-provider lifecycle rather than assuming Google.
- Direct transport keeps Google access tokens in one per-tab module instance only, clears them on expiry/session generation/cross-tab invalidation, removes any retired persisted-token record, deduplicates concurrent same-tab session validation, and keeps all Worker/Google API traffic outside service-worker Cache Storage. Direct reads/writes use retry-safe Google operations and the Worker does not receive routine Drive file bodies.
- In the provider-neutral path, the active cloud session also authenticates
  hosted email, privacy-safe synced metrics, and future Pro state. Provider
  subjects are domain-separated hashes; transfer links them only after target
  readback verification and before activation. This control-plane identity does
  not expose product records or turn the Worker into a file proxy.
- Destructive data, billing, deletion, and sync actions require explicit intent and safe preview/confirmation where available.
- Agent access is loopback-only with short-lived pairing, scoped permissions, approvals, rate limits, and revocation. App-session bearer tokens are bounded to memory/current-tab resume state. Same-profile browser reopen uses a non-exportable origin-local P-256 key and replay-safe challenge to obtain a fresh token; the matching public authorization remains only in the live bridge, so Gateway restart requires pairing.
- Private Worker source, secrets, provider identifiers, and internal operational material do not enter the public repository.

## Development and verification

All Node/npm work runs through Docker-backed Make targets. Vitest tests are colocated throughout `src/`; integration tests live in `src/test/integration/`; Playwright browser flows live in `e2e/`. Repository-wide TypeScript checking is a required release gate, and CI runs `make release-gate`.

See `ARCHITECTURE_MAP.md` for module navigation, `spec/roadmap.md` and `status/_status.md` for current work, and `spec/ambiguities.md` for unresolved decisions.
