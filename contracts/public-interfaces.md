# Public Interfaces

These interfaces are durable boundaries. Implementation types, validation, generated catalogs, and tests must remain aligned with this contract.

## Browser application routes

The stable route surface is defined in `spec/routes.md`. Navigation uses History API state through `useUrlState`; route changes must preserve reload and back/forward behavior and must not capture public Astro routes.

## React data APIs

Components obtain product state and mutations through entity hooks under `src/hooks/`, including projects, clients, tasks, time entries, timers, invoices, expenses/recurrences/categories, tax periods, business information/assets, payment/invoice/email templates, preferences, notes, planner attachments, goals, and sync/auth behavior.

Callers must not create a second persistence layer. Hook return shapes may evolve additively, but established mutation semantics and persisted effects are durable.

`useTimers` is the browser timer-lifecycle boundary, including stop recovery and timer-created entry snapshots; `stopTimer` resolves asynchronously after complete-history validation/recovery. `useTimeEntries` keeps generic internal CRUD for controlled billing/deletion applications and exposes asynchronous protected manual-entry mutations for user-facing create/edit/delete flows so historical documents and archived task relationships are loaded before mutation. Project, client, and task hooks validate relationship-bearing writes through the same domain contracts used by agent commands; persisted entity IDs are immutable and create operations reject an existing ID before writing.

The planned active-client entitlement adds one shared transition contract beneath
every browser and agent adapter. `active` means `archived !== true`. Free permits
one active client; Trial/Pro are unlimited. `create_client`, explicit unarchive,
and generic `update_client({archived:false})` revalidate immediately before a
net-increasing mutation. Successful idempotent replay resolves before counting.
Imports, restores, sync merges, downgrade, and existing over-limit state bypass
forward enforcement and never hide, discard, or auto-archive records.

`useExpenses` retains synchronous raw create/update methods for controlled internal applications, while user-facing paid or payment-sensitive mutations use `createExpenseWithPaymentSnapshot` and `updateExpenseWithPaymentSnapshot`. Those asynchronous methods prepare required cross-currency evidence before committing. `deleteExpense` rejects billed/invoice-linked and tax-claimed expenses on every UI call path.

`useInvoices.cancelInvoice` and the agent `cancel_invoice` command are adapters over one shared cancellation application. The operation accepts `invoiceId`, a trimmed 1–500 character `reason`, a stable `operationId`, and an optional finite `canceledAt`; adapters additionally require exact invoice-number confirmation and agent approval. It returns the retained canceled invoice plus stable counts for released time entries, deleted adjustment entries, released expenses, released quoted tasks, restored task cutoffs, and retained project links, with `retainedInvoiceNumber: true` and retry state through `alreadyApplied`. The operation rejects missing, draft, paid, and conflicting already-canceled invoices without partial product mutation and replays the same persisted operation idempotently.

`useInvoices.markAsUnpaid` and the agent `mark_invoice_unpaid` command are payment-correction boundaries, not refund operations. They accept only an invoice whose current persisted status is `paid`, clear its payment evidence, and preserve every billing-source claim. Missing, non-paid, and canceled invoices fail without mutation; callers cannot use this transition to reopen or alter a sent, overdue, draft, or canceled invoice.

## Persisted Yjs boundary

- Managed document names: `core`, `entries-active`, `entries-{year}`, `tasks-archived`, `expenses-archived`, `invoices-archived`.
- Collection/entity contracts: `contracts/data-schemas.md`.
- Unknown additional entity fields are tolerated where validation uses passthrough, enabling forward/legacy compatibility.
- Cross-document operations must remain safe under replay, partial completion, reconnect, and concurrent-device updates.

## Backup JSON

Current export version: `1.5`.

Supported import versions: `1.0`, `1.1`, `1.3`, `1.4`, `1.5`.

Top-level payload:

```text
version: string
exportDate: ISO-8601 string
backupType?: automatic | manual
projects: Project[]
tasks: Task[]
timeEntries: TimeEntry[]
invoices: Invoice[]
paymentMethods: PaymentMethod[]
expenseCategories?: ExpenseCategory[]
taxReturnPeriods?: TaxReturnPeriod[]
businessInfos: BusinessInfo[]
businessBrandAssets: BusinessBrandAsset[]
clients: Client[]
invoiceTemplates: InvoiceTemplate[]
emailTemplates: EmailTemplate[]
expenses: Expense[]
expenseRecurrences: ExpenseRecurrence[]
dailyGoals: DailyGoal[]
plannerAttachments: PlannerAttachment[]
preferences: Preferences
```

Imports validate version, container types, unique identifiers, time ranges, task hierarchy/project references, time-entry task references, and project invoice references before mutation. Missing collections supported by historical versions normalize to empty arrays/default objects. Credentials and cloud/agent sessions are never exported.

Replacement restore is journaled outside the managed Yjs databases before any
destructive mutation. The journal includes the prior workspace and active
timers, is cleared only after a persistence barrier, and is recovered on the
next startup if the restore was interrupted.

## Sync Worker HTTP boundary

Configured by `VITE_SYNC_WORKER_URL`. Public client endpoint families are:

- `/auth/init`, `/auth/callback`, `/auth/revoke`, `/auth/status`
- `/auth/access-token`
- `/auth/dropbox/init`, `/auth/dropbox/callback`, `/auth/dropbox/revoke`, `/auth/dropbox/status`
- `/auth/dropbox/access-token`
- `/auth/hosted-identity/transfer`
- `/metrics/batch`
- `/email/invoice`
- `/push/vapid-public-key`, `/push/subscription`, `/push/schedules`, `/push/test`

Planned, disabled-until-released billing/entitlement endpoint additions are:

- `/.well-known/tasktime-license-jwks.json`
- `/billing/catalog`
- `/billing/status`, `/billing/trial/start`, `/billing/checkout`,
  `/billing/checkout/abandon`, `/billing/portal`, `/billing/refresh`,
  `/billing/account`
- `/billing/webhook` (Stripe signature only; no browser CORS/session authority)
- `/email/attempt/status` and the versioned/idempotent Pro contract on the
  existing `/email/invoice` route

The detailed versioned request/response, signed-license, identity, catalog,
idempotency, error, compatibility, and rollout contract lives in the private
implementation plan until the matching code slice lands. Public catalog/JWKS
origins remain separate from exact private app origins; neither exposes Stripe
IDs, secrets, or account state. Live purchase configuration fails closed while
the catalog/legal/operational gates are unapproved.

The dev/build pipeline validates the configured Worker URL and adds only its
origin to the HTML `connect-src` policy. HTTPS is required except for explicit
loopback development URLs; malformed, credential-bearing, or non-loopback HTTP
values fail closed instead of weakening the browser policy. An alternate
configured build therefore does not require the production app to permanently
trust another Worker hostname.

The Worker owns provider OAuth code exchange, encrypted refresh-token persistence, session validation, token issuance, revocation, and opaque hosted-identity linking. The browser owns product data semantics. A successful provider-bound status response selects direct Google Drive or Dropbox for the next connection. The browser sends its non-secret build identifier in `X-TaskTime-App-Version` and matching `appVersion` query parameter on status and token requests. Direct connections request a short-lived provider access token, retain it only in active-tab memory, and send routine sync file requests directly to the selected provider. The Worker must never return a refresh token or receive routine provider file bodies. Errors exposed to the browser must be sanitized; private deployment/KV/D1 details are not part of this public contract.

`POST /email/invoice` accepts the existing opaque `X-Session-Id` and an invoice, reminder, or quote email payload containing a base64 PDF attachment. The browser and Worker both require the decoded attachment to start with the PDF signature and contain a final PDF end-of-file marker before the provider call. TaskTime Pro does not persist the attachment bytes.

The planned Pro cutover adds a durable request idempotency key through an additive
compatibility window and checks canonical `invoice.email.send` entitlement plus
an atomic UTC-month allowance only when TaskTime-hosted Send is invoked. Email
preview/template editing, PDF download, copy/manual delivery, and draft recovery
remain Free. Each provider-accepted primary/forward part consumes one unit.
Acceptance-unknown parts remain reserved and can never be replayed as a new
logical send. The browser may make one bounded retry of the byte-identical
request with the same TaskTime attempt, request-idempotency, and provider-
idempotency evidence; provider acceptance therefore remains exactly once. New
tracking uses domain-separated keyed hashes and stores no recipient,
subject/body, PDF, filename, or invoice number.

An acceptance-unknown send returns versioned `202 DELIVERY_PENDING` with the
same non-secret attempt reference. Signed provider webhooks and the bounded
Worker reconciler can advance the durable outcome of an already-contacted part;
neither creates or resends a message. Allowance exhaustion retains the
established `429` transport status with a distinct `QUOTA_EXCEEDED` code so
legacy clients remain safe while rate limiting uses `RATE_LIMITED`.

`POST /email/attempt/status` accepts the closed body
`{ version: 1, attemptId }` for the authenticated hosted principal and returns
only TaskTime attempt, primary/forward outcome, accepted-time, and effective
quota projections. It is provider-free and never retries a message or consumes
or releases allowance. The Worker may take a short account-coordination claim
and retain a bounded, privacy-minimized no-send marker before returning a
definitive missing-attempt result; it does not mutate attempt or quota business
state. New Send and status responses never expose raw Resend/provider IDs,
recipient/content, PDF, provider subject, or session data. A bounded legacy
`resendId` field may survive only as an alias for the opaque TaskTime attempt ID
when characterized consumers treat it as opaque; otherwise the Worker returns
the documented safe client-update response.

An authenticated `404 ATTEMPT_NOT_FOUND` for the exact active-lifecycle local
attempt proves that TaskTime has no durable reservation to reconcile. The client
marks only that bound local marker rejected and silently returns to a fresh
explicit Send action. Existing attempts and entitled-send `5xx` responses are
reconciled automatically through status, without exposing a manual status
button. The modal performs a short bounded check, then stops loading and leaves
the attempt quietly protected; invoice lists continue bounded background
reconciliation. A provider-accepted primary is applied to the current invoice
only after lifecycle, document identity, and immutable send-time snapshot
validation, which removes the original Send action and shows the sent state. If
a crash or reload occurs after a terminal completion marker is retained but
before the matching Yjs sent timestamp persists, only the missing timestamp opts
that marker back into owned status proof and idempotent application. A terminal
partial result is eligible only when the primary customer copy was accepted;
the optional rejected forward remains a warning. Status recovery never starts or
replays a send, and an invoice with sent metadata does not continue polling;
disabled, unauthenticated, malformed, and unavailable responses remain
fail-closed.

The planned `GET /billing/catalog` and license JWKS are public, sanitized,
credential-free, bounded-cache resources. Authenticated status and all billing/
email mutations require the exact app origin plus provider session and are
`no-store`; the Stripe webhook is a separate raw-body signature boundary. One
canonical primary snapshot produces both the signed entitlement and its display
projection with the same monotonic `entitlementRevision` and plan-config version.
Only the verified JWS authorizes advanced Reports or unlimited-active-client
transitions; Free Reports Overview is not protected. Email usage has an
independent revision/availability and never grants or revokes local entitlement.

A valid intentionally disabled catalog still returns both plan rows, no offers,
and `purchaseEnabled:false`; the Pro email allowance may be null only while
trial acquisition, purchase, and hosted delivery are all disabled. Missing or
malformed catalog configuration returns a sanitized versioned
`503 CATALOG_UNAVAILABLE` response and never a partial or guessed offer.

Catalog version 1 contains exactly one Free row and one Pro row. Free advertises
`activeClients:1`, the basic current-month Reports Overview, zero hosted sends,
and no offers. Pro advertises unlimited active clients, advanced Reports, hosted
email, and the configured allowance. It contains two annual EUR offers in stable
order: founding with `unitAmountMinor:3900`, `memberLimit:250`, and availability
`available | temporarily_reserved | exhausted`; then standard with
`unitAmountMinor:5900` and no founding capacity. No Stripe identifier or exact
remaining count is public. Checkout atomically reserves founding capacity before
creating a founding Session. `temporarily_reserved` is retryable and does not
select standard early. At 250 committed allocations—or for a former founder
whose founding subscription ended terminally—the effective new-purchase offer is
standard. Standard Checkout never mutates founding slots. A stale founding
request returns the standard order summary for explicit reconfirmation and
creates no Stripe state. Paid allocations never recycle and the same continuous/
recoverable subscription retains its recognized immutable Price. The client
consumes catalog/status values and never embeds price/tax/allowance/legal or
Stripe configuration as its authority. Checkout redirects require the exact
credential-free `https://checkout.stripe.com` host and preserve Stripe's opaque
URL fragment state for hosted Checkout navigation. An expired recovered Checkout
is retired server-side before the browser retries once from the same explicit
purchase action. The retry remains bound to the requested offer and plan version;
normal stale-offer reconfirmation still applies, and raw Worker billing codes are
not customer-facing copy.

The initial Portal contract exposes invoice/payment-method maintenance and
cancel-at-period-end only; it cannot switch Price, interval, quantity, or prorate
a founding subscription. Cancellation surfaces the effective date and founding-
eligibility consequence. Reversal before period end preserves the same Price;
terminal cancellation cannot be reactivated as a founding purchase and a later
new subscription uses the current standard offer. The status-level Portal signal
does not by itself make billing management a Free-plan action: the browser shows
**Manage billing** only while canonical Pro is backed by a subscription. The
fixed Portal return includes an app-owned marker that triggers authenticated
canonical reconciliation before removal, but only after the lifecycle-selected
provider connection has finished reconnecting. Provider transport readiness is
not billing identity: the browser selects a still-valid signed assertion through
the persisted exact provider/generation/session-fingerprint binding during
startup, reconnect, and offline operation without issuing a status request or
clearing that binding. Only online status refresh and Stripe actions require the
settled provider connection. A transient return failure may
retry after a newer canonical billing-status projection arrives and must not
remain latched merely until tab navigation. The marker is only a refresh trigger,
never cancellation evidence; signed status derived from Stripe reconciliation
and subscription webhooks remains authoritative. Browser-offline presentation
requires the browser network state to be offline rather than any retryable
billing transport or session error.

The explicit **Refresh status** action is stronger than an ordinary foreground
status check: after provider reconnection is ready, it requests canonical billing
reconciliation with reason `user_retry` and then forces a fresh signed status
read. The normal foreground cooldown must not suppress either step.

The stable `TT-XXXX-XXXX` account reference in authenticated billing status is
an opaque support/operator handle derived from the canonical hosted principal.
Plan & Billing shows it after the selected provider label and available email;
it is not an authentication credential, provider subject, billing contact, or
Stripe identifier. Permanent complimentary Pro is administered only through a
private owner operation: it supports exact-account preview, issue, retained
history review, and revocation. Mutations require explicit environment-specific
confirmation, are atomic and idempotent, permit one active grant per canonical
principal, advance the account revision, and retain owner/reason audit evidence.
There is no public grant HTTP endpoint. The local rehearsal reuses the same
domain operations while remaining unable to address production state.
The source has no scheduled expiry, but normal signed assertions remain bounded;
verified provider transfer carries the grant. It never mutates Stripe objects,
founding allocations, trial activation/eligibility, product data, or Yjs state.
If a paid subscription and complimentary grant coexist, subscription remains the
displayed/effective source until its access ends. Explicit billing-profile
deletion is the only public-flow consequence that revokes an active grant; it
does so transactionally, invalidates the
canonical account revision, and retains both grant history and a self-service
revocation audit event.

The authenticated billing-status envelope is itself versioned. Every successful
canonical Free response includes a signed Free JWS that definitively deselects
older Pro for the same lifecycle. Identity conflict and canonical unavailability
are typed error envelopes with `license: null`; clients render repair/retry or
update guidance, never Free or a repurchase prompt. Email usage separates
effective sendability from an optional retained UTC-window history so downgrade
cannot display old remaining units as currently usable.

`POST /auth/access-token` accepts the existing opaque `X-Session-Id`, optional non-secret `X-TaskTime-App-Version`, and no credential in its URL. It accepts only an optional boolean `forceRefresh` body field, returns a short-lived bearer token, its absolute expiry, Worker time, and known grant scope. Every success and failure response is `no-store`.

The `/auth/dropbox/*` family is provider-bound and accepts no Dropbox file path or file body. Dropbox authorization uses App Folder access with the approved content/metadata read/write scopes plus `account_info.read` solely for connected-account presentation. `POST /auth/dropbox/access-token` returns a short-lived memory-only token for direct browser-to-Dropbox requests. The browser calls Dropbox's current-account endpoint directly, validates the verified/non-disabled email, and may add it to the origin-local Dropbox auth-session record. The Worker never receives that profile response, and the email never enters Yjs, provider sync, backup/export/import, logs, or metrics. The narrow exception is an explicit paid Checkout request: the browser may submit the locally verified email as `billingContactEmail`, which the Worker stores only as the billing contact and supplies to the owned Stripe Customer. File-scope-only stored sessions remain valid and expose a null email until explicit reconnect.

Billing status retains the stable opaque `accountReference` and provider-scoped `displayLabel` as compatibility/support contracts. Plan & Billing presents the connected provider email when locally available and otherwise uses neutral connected-provider copy; it never exposes the stable reference as customer identity, and trial/billing authority never derives from the email. Checkout request version 1 accepts the optional normalized `billingContactEmail` in addition to `offerId`, `planConfigVersion`, and `idempotencyKey`. Old clients may omit it. The first accepted billing contact prefills a new or email-less mapped Stripe Customer; a pre-existing Stripe billing email is preserved rather than silently replaced after a provider reconnect or transfer.

`POST /auth/hosted-identity/transfer` accepts two authenticated provider sessions,
the additive UUID-v4 `X-TaskTime-Transfer-Id`, and no payload after target
readback verification. The operation ID binds a durable idempotent transfer
journal; reuse with different source/target intent conflicts. It links their
domain-separated provider subjects, billing ownership, and journaled email-quota
alias/merge to one opaque TaskTime principal before target activation and never
returns either raw provider subject. Identity/email-store unavailability or an
unfinished cross-database transfer keeps hosted actions fenced and fails closed.

Provider-grant revocation and local disconnect are separate auth primitives. The connected-provider UI composes them into two choices: Disconnect retains authorization and provider data, while Wipe data & disconnect removes verified TaskTime sync files and backups before revocation. The browser clears its stored Worker session after confirmed revocation or an already-invalid grant, but preserves it and surfaces an error when revocation fails transiently so the operation can be retried truthfully.

A verified moved-source marker is exposed as a recovery choice rather than a
generic connection error. Connecting the recorded destination is the primary,
non-destructive action. Reusing the source is a secondary destructive action
that clears only that source's TaskTime backups and sync objects, leaves the
destination unchanged, and seeds the local workspace without pulling or
merging retained source data.

## Browser-to-bridge command protocol

Agent command results are discriminated responses:

```text
Success: { ok: true, command: string, data: T }
Failure: { ok: false, command: string, error: { code, message, details? } }
```

Error codes: `APP_NOT_READY`, `NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `PERMISSION_DENIED`, `RATE_LIMITED`, `UNAVAILABLE`. The local entitlement candidate adds a stable `ENTITLEMENT_REQUIRED` code; it is not a published artifact change until the separately approval-gated agent release train ships. Closed sanitized reason metadata covers the active-client limit, founding-offer temporarily reserved/ended, or billing suspension where applicable. Hosted-email details additionally preserve documented legacy fields while mapping quota, idempotency, ambiguous delivery, reauthentication, and temporary billing failures consistently.

Permission scopes: `read`, `write`, `billing`, `export`, `email`, `navigation`.

Pairing launch URLs carry the requested scopes so TaskTime Pro can display them before the user approves the connection. Persistent approval grants are keyed to the configured stable agent ID and must not authorize a bridge process presenting a different agent identity, even when the requested scopes otherwise match.

Browser continuity adds message types without changing the existing pairing, command, approval, or bearer-token resume shapes:

- `agent_bridge_reconnect_register` is authenticated by the current app session and carries a public JWK only. The bridge accepts only an EC P-256 public key with no private component and binds it to the current bridge instance, allowed browser origin, agent identity, exact granted scopes, and an expiry no later than the paired session.
- `agent_bridge_reconnect_registered` returns only an opaque key ID, opaque bridge instance ID, and absolute expiry. Those values are routing/binding metadata, not credentials.
- A connection presenting a recognized reconnect key ID receives `agent_bridge_reconnect_challenge`, containing a cryptographically random nonce, opaque challenge ID, bridge/key IDs, allowed origin, and an expiry no more than 30 seconds in the future.
- `agent_bridge_reconnect_proof` carries the challenge/key IDs and an ECDSA P-256/SHA-256 signature over the exact canonical UTF-8 JSON encoding of `{ domain: "tasktime.agent.browser-reconnect", protocolVersion: 1, bridgeInstanceId, keyId, challengeId, nonce, origin, expiresAt }` in that property order.
- The bridge atomically consumes the challenge before verification/session issuance, rejects replay or any origin/instance/key/expiry mismatch, and returns the existing `agent_bridge_session` message with a fresh token and no broader scopes after successful proof.
- An authenticated `agent_bridge_reconnect_forget` removes that browser key authorization and sessions issued through it without changing separately paired browser credentials. Existing `agent_bridge_control` revocation remains the all-session authority-ending path.

The browser's current-tab bearer resume record is a closed, versioned `sessionStorage` shape containing the validated loopback endpoint, session token, exact scopes, created/expiry timestamps, and optional stable agent ID/label. The bearer token is never copied to another tab or durable store.

Same-profile close/reopen uses a separate dedicated IndexedDB credential database. Its closed versioned record contains only the validated loopback endpoint, bridge instance ID, reconnect key ID, non-exportable sign-only P-256 private `CryptoKey`, stable agent ID/label, and finite created/expiry timestamps. It is not product data: it never enters Yjs, Drive, backup/export/import, cross-tab messages, or general entity hooks. Unknown/malformed/expired/algorithm-incompatible records are deleted and require explicit pairing. Browsers unable to persist the key safely fall back to current-tab resume or pairing.

Command groups include:

- projects, clients, tasks, cascade previews/deletions, archives
- timers and time entries
- planner attachments, goals, and project notes
- expenses, recurrences, categories, and tax periods
- invoice/quote preview, drafts, finalization, payments, cancellation, undo, PDF, and email
- business information/assets, payment methods, invoice/email templates, preferences
- reports, accountant/export outputs, dashboards, and unbilled queries
- cloud sync/backup/import/account data operations
- application navigation

The authoritative command-name/metadata catalog is generated from `src/agent/commands/registry.ts`. A command may additionally require explicit TaskTime approval and idempotency/confirmation data. Changes require synchronized tool schemas, bridge package, bundles, public docs, and tests.

The local, unpublished entitlement candidate adds declarative argument-aware
entitlement metadata and central pre-data-access enforcement while keeping stable
command names discoverable. `get_report_summary` adds
`scope: 'basic-current-month' | 'advanced'`; omitted scope compatibility-defaults
to `advanced`. Only the explicit basic scope, Overview section, default filters,
and no rows are Free, and that branch runs before all-history collection. Advanced
summary and `export_report_csv`, `export_report_pdf`, and
`export_accountant_pack` require `reports.access` before data collection.
`send_invoice_email` and `send_project_quote_email` require hosted-send access.
Client create/unarchive commands apply the shared count transition above rather
than globally gating client commands. The seven tax-period/expense-claim
bookkeeping commands and all core/dashboard/client/project/unbilled/PDF/cloud/
portable-backup commands otherwise remain Free.

The explicit Free report result is the closed `BasicReportsOverviewV1` shape:

```text
{
  version: 1,
  scope: "basic-current-month",
  period: { startAt: RFC3339, endBefore: RFC3339, timeZone: IANAZone },
  received: [{ currency, amount }],
  expenses: [{ currency, amount }],
  trackedTimeMs: number
}
```

Currency arrays are normalized and sorted, and contain finite totals only.
Explicit basic scope works from always-loaded local data without a provider or
billing request in Free fallback and suspended states. Before any product-data
collection, advanced sections, filters, custom periods/dates, rows/details,
exports, unknown arguments, or incompatible basic values are rejected by
presence. Missing scope remains the compatibility-gated advanced default.

Provider-neutral cloud commands are canonical. The shipped Drive-named backup commands remain deprecated, Google-only compatibility aliases so existing MCP and OpenClaw automations continue to work; new integrations must use the corresponding `*_cloud_*` commands. Removing those aliases requires an explicit major-version migration.

`stop_timer` accepts an optional `idempotencyKey` and also converges concurrent stops through deterministic timer-instance entry identity. Manual time-entry commands validate complete local history and source/target billing rules before mutation. Generic `update_task` requests are normalized through task-state invariants; recurring completion still requires the occurrence-aware `complete_task` command. Create commands return `CONFLICT` for an existing persisted ID and must not replace the prior record.

`find_unbilled_time`, dashboard/project unbilled summaries, and recent-entry billing state load complete local task, time-entry, and invoice history. Unbilled results use canonical invoice eligibility and legacy finalized-invoice evidence; entry summaries preserve `durationMs` as actual elapsed time and add `billableDurationMs` for invoice calculations.

`cancel_invoice` is billing-scoped and approval-required. Its closed input contains `invoiceId`, `reason`, `confirmCancel: true`, exact `confirmationText`, optional finite `canceledAt`, and optional retry-safe `idempotencyKey`. Missing invoices return `NOT_FOUND`; invalid reason/confirmation returns `INVALID_INPUT`; draft, paid, terminal, or conflicting operation state returns `CONFLICT`; unavailable complete history returns a sanitized retry-safe error. Responses expose documented invoice summaries and release counts, never raw Yjs maps or journal records. Invoice/report status filters add `canceled` without renaming or changing existing defaults.

## Local bridge process

Configuration may be supplied by CLI flags or the documented `TASKTIME_AGENT_*` environment variables in `.env.example`. Defaults must remain loopback-safe. Status-file discovery may expose only non-secret operational metadata such as endpoint, process/instance identity, lifecycle state, connected browser-session count, and pairing expiry/readiness. New writers must not persist pairing IDs, pairing codes, credential-bearing launch URLs, app-session tokens, approval tokens, reconnect signatures, or private keys. Readers must tolerate the historical status shape during migration, and producers retain compatible non-secret fields while removing credential-bearing values as a security correction.

Credential-bearing pairing information is limited to an explicit short-lived setup response or the interactive process terminal and must not be copied into persistent logs/files. Stable managed identities include platform-specific `agent-id` and `agent-label`; neither they nor the dynamic port authenticate a process. Pairing codes are single-use/short-lived, app sessions expire or end on revocation/process exit, and browser reconnect authorization also ends on expiry, forget/revoke, access disable, or bridge/Gateway exit.

The official native OpenClaw plugin owns one packaged bridge child through `api.registerService(...)` only during OpenClaw's full Gateway runtime registration mode. It declares its generated tools in `openclaw.plugin.json`, registers the same tools through the supported plugin SDK, and keeps generic stdio/MCP package entrypoints available. Native-format precedence must prevent the compatibility `.mcp.json` from launching a second bridge. Recognized legacy `mcp.servers.tasktime` configuration is reported as an explicit migration conflict rather than killed or silently rewritten.

## Published artifacts

- npm: `@tasktimepro/agent-bridge`
- MCP Registry: `pro.tasktime/agent-bridge`
- binary: `tasktime-agent-bridge`
- discovery: `/.well-known/tasktime-agent.json`
- tool catalog: `/agents/mcp-tools.json`
- generated skill: `/agents/skill.md`
- OpenClaw and Claude bundles under `integrations/`

The discovery manifest is additive and advertises explicit core-use facts under
`app`: no TaskTime account is required for core use, core use is free, the PWA
is offline-capable, the source is public, work records use browser-local
storage, and limited aggregate usage metrics are enabled on the production
origin. Its `clawHub` object identifies the canonical `tasktimepro` owner,
`tasktime-agent` slug, owner-qualified reference, public source repository, and
source path. Consumers must tolerate additional manifest fields.

Release coordination is specified in `docs/agent-release-runbook.md`.
