# Acceptance Criteria

## Local-first and compatibility

- A returning user can open an existing supported IndexedDB dataset after an upgrade without clearing browser data.
- A supported historical backup or Drive record is validated/migrated and retains valid relationships.
- Offline use allows local work; unavailable cloud actions fail visibly without corrupting local state.
- Reconnecting never silently replaces unsynced valid local work with an older remote snapshot.
- Core use does not require a TaskTime account or cloud sync, and public discovery metadata states that work records use browser-local storage.
- The production build emits an app-only artifact, a public-site-only artifact,
  and the existing combined compatibility artifact. Only the app artifact owns
  the PWA manifest, service worker, and SPA fallback; only the site artifact owns
  Astro routes, robots/sitemap/`llms.txt`, and public discovery. The combined
  artifact retains the application root until the separately approved cutover.
- Build assembly fails on unequal path collisions, missing required outputs,
  an incorrect `/product/` canonical URL, or a missing referenced site asset;
  byte-identical shared brand assets remain valid.

## Work and time

- Users can manage clients, projects, tasks/subtasks, notes, planner attachments, and goals through the corresponding screens.
- A subtask cannot be configured as recurring.
- Two projects may have timers concurrently, but a project cannot hold two active timer states.
- Pause/resume preserves elapsed duration without creating an entry.
- Stop creates one entry for the selected task, including the correct interval/note, and clears only that timer.
- Repeating a recovered stop operation does not create a duplicate entry.

## Billing and finance

- Invoice preview includes only eligible selected work/expenses and its totals equal the visible line calculation, adjustments, and tax.
- Finalization applies billing markers once and preserves snapshots needed for reporting/payment/undo.
- A paid invoice exposes an explicitly confirmed **Mark as unpaid** correction that clears its recorded payment date and currency snapshot, preserves its finalized billing-source claims, and returns it to the effective Outstanding or Overdue bucket; the UI makes clear that this does not issue a refund.
- Undo restores only the supported latest invoice effects and is safe against repeated invocation.
- Canceling a sent or overdue unpaid invoice retains its invoice number, original monetary and billing snapshots, sent metadata, project links, and required cancellation reason/time while releasing only time, adjustments, expenses, quote claims, and task cutoffs still owned by that invoice.
- Cancellation is terminal and retry-safe: drafts and paid invoices are refused without mutation, an exact invoice-number confirmation is required, stale replay cannot make a canceled invoice payable again, and a later invoice's source claim or task cutoff is never cleared.
- A canceled invoice appears only in the Canceled invoice-list bucket, is read-only/non-payable/non-emailable, and every preview/export visibly identifies it as canceled; the next invoice never reuses its number.
- Quote preview/export/send does not mark work billed.
- Expense and tax state transitions are explicit and reflected consistently in reports/exports.

## Reports and portability

- Equivalent filters produce consistent on-screen, CSV, PDF, and accountant-pack totals.
- Canceled invoices remain visible in audit/register scopes with original face value and cancellation metadata while contributing zero to financial, tax, payment, outstanding, aging, statement, and project-revenue totals; released eligible sources reappear exactly once in browser and agent unbilled views.
- Backup export excludes auth/session secrets.
- Import preview reports validation issues before mutation.
- Accepted import preserves supported records and relationships; rejected input leaves current data unchanged.
- The supervised app-origin cutover restores a user through the existing
  provider bootstrap or validated complete portable backup/import boundary.
  The source stays available until record counts, historical data, and selected
  records are verified at the new origin; rejected import leaves the target
  unchanged and interrupted replacement remains recoverable.
- OAuth/session state, access or refresh tokens, billing/license state, Push
  subscriptions, agent pairing credentials, and metrics identifiers are not
  exported or copied. The user reconnects, opts in, or pairs again at the new
  origin.
- Marketing, application, Worker, and agent-documentation
  origins are explicit validated configuration. The exact old and new HTTPS app
  origins and explicit loopback HTTP origins are accepted; credentials,
  wildcard/suffix matches, arbitrary subdomains, non-loopback HTTP, unexpected
  ports, paths, queries, fragments, and non-exact OAuth return URLs fail closed.
  Google Drive and Dropbox callbacks pass the same old/new-origin matrix, while
  the signed license audience remains independent of hostname.
- Worker regressions authorize `app.tasktime.pro` for Google Drive and Dropbox
  OAuth/token paths, hosted email, Push, metrics, and private billing while
  continuing to reject inferred or malformed origins.
- Production origin-cutover evidence identifies the exact pre-cutover Pages,
  Worker, DNS, OAuth, email, Push, and deployment-authority state. The existing
  root Pages project remains unchanged while one new permanent app project is
  tested; the single shared Worker accepts both exact origins without cloning
  D1/KV, email, Push, rate-limit, or provider-data services. The exact combined
  root artifact and deployment are retained durably and proven usable for
  rollback before the public-site switch.
- The root project receives only the public-site artifact after every known user
  and active device is verified at the new origin and old root Push/PWA/service-
  worker registrations are retired without clearing old IndexedDB. Post-window
  cleanup removes obsolete old-origin/callback/temporary-preview authority,
  leaves one deployment authority per Pages project, and proves the final state
  contains exactly the intended app and site projects, one shared Worker, and no
  orphan migration resource.

## Subscription and Pro boundary (implemented locally; production controls remain off)

- An explicit local billing-sandbox flag is honored only by a Vite development
  build on a loopback hostname. It does not add sandbox-only banners or
  developer-facing notices to product screens, disables the bundled catalog
  fallback, and exercises the normal provider-bound catalog,
  status/JWKS/license, trial, Stripe test Checkout, webhook, reconciliation,
  Checkout-return, and Portal paths against the local Worker and isolated local
  service state. Checkout return handling waits for the matching active cloud lifecycle and
  retains the return marker until that lifecycle exists. The local Worker accepts
  only the exact `http://localhost:3101/account?section=billing` return base;
  production retains only the exact HTTPS app return. Hosted Send and delivery-
  status requests exercise the normal Pro entitlement, quota, idempotency, and
  recovery path against local D1 and the configured Resend account. Actual
  delivery requires the ignored local `RESEND_API_KEY` and an explicit Send to a
  test recipient controlled by the developer. A production build or non-loopback
  hostname ignores the flag, tracked production controls remain off,
  and test-mode state is never launch or production evidence. Product-data
  mutations remain ordinary real local-workspace operations and retain the
  configured sync-mode behavior; billing sandbox mode is not a disposable data
  sandbox.
- In an operator checkout, the supported developer entrypoint is `make dev`. It prepares the
  ignored local test configuration and migrations, then runs the app, local
  Worker, and Stripe test-webhook listener as one attached Docker Compose
  stack. Every Worker control enabled in tracked production configuration stays
  enabled locally, while guarded unreleased billing behavior may be enabled only
  against local state and Stripe test mode. Preparation fails with a sanitized,
  actionable error when the ignored local Resend credential is absent. Stopping
  that command stops the complete stack. The billing-specific target remains a
  compatibility alias; a public checkout without private infrastructure retains
  an explicit core-app fallback. An expired or missing owner-controlled Stripe
  test login and locally stored service credentials remain external prerequisites.
- A Free user can open `/reports` and use Overview for the current local calendar
  month. It shows exactly **Received**, **Expenses**, and **Tracked time** under
  the canonical date, duration, legacy-payment, and currency semantics, with no
  advanced filters, history, rows, exports, or other financial aggregates.
  Overview renders immediately from always-loaded local data without waiting for
  a provider, catalog, JWKS, or billing-status request. Missing, unknown,
  malformed, and case-mismatched report sections canonicalize to Overview.
  Every advanced tab, including To Invoice, remains visible, directly
  addressable, and keyboard-accessible. Selecting one renders its section-
  specific static Pro preview without mounting the advanced module, loading
  protected history, requesting exchange rates, or exposing advanced values/
  exports. Dashboard, client/project/unbilled views, invoices/PDFs, Expenses/tax
  bookkeeping, email preparation/manual delivery, portability, supported cloud
  behavior, Web Push, and core agents remain usable.
- `get_report_summary({scope:"basic-current-month"})` is Free and returns only
  the closed versioned three-metric Overview contract. Omitted scope compatibility-defaults to
  `advanced`; advanced summary and all report CSV/PDF/accountant-pack exports
  require `reports.access`, branching before `collectReportsData()`. All seven
  tax-period/expense-claim commands remain Free and expose no report aggregate
  through that path.
- Free allows a first active client. At the limit, every browser and agent
  create/unarchive path refuses only the net-increasing transition with the same
  typed policy; archiving frees a slot and upgrading never auto-replays the
  action. Idempotent replay is resolved before counting. Downgraded, imported,
  restored, synced, or concurrently merged over-limit clients remain visible,
  editable, usable, archivable, deletable, exportable, and recoverable without
  silent correction.
- A compact Expenses-side browser surface likewise keeps tax-period list/create/
  update/mark-filed/mark-paid and expense claim/unclaim operations Free while
  exposing no Reports aggregate, filter, or export.
- An eligible connected TaskTime cloud account starts one 30-day no-card trial only after the
  user explicitly selects **Start free trial** with the connected provider email
  shown beside that action, or neutral connected-provider copy when the email is
  unavailable. The stable opaque account reference is shown at the end of the
  Plan & Billing account label as a support/operator reference; it is not an
  email address, login identifier, or Stripe identifier. No redundant checkbox
  is required. The trial remains consumed across devices, reconnecting
  the same provider identity, product-data deletion/import, and a verified
  Google Drive/Dropbox transfer. OAuth/navigation/
  retry never starts or moves it. Operational rollout/canary controls never
  grant Pro or consume it. Early
  purchase takes precedence without pausing the original trial, which remains a
  fallback until its immutable end.
  Exact trial expiry removes only that source; advanced Reports, hosted Send, and
  future active-client increases close only when no paid or grant source remains.
- Cold-offline Pro is selected only through the exact provider/generation/session-
  fingerprint binding. Wrong/missing/staged bindings, account switches, late
  responses, invalid signatures, excessive clock rollback, and expiry cannot
  authorize cached Pro and never delete product data. A verified signed Free
  status renders Free; unresolved lifecycle, unsupported response version, or
  transient/unsafe status failure renders eligibility unknown/unavailable with
  retry/update/repair guidance, never a misleading **Get Pro** prompt. Stale
  responses are ignored rather than converted into a plan decision. Initial
  provider-state loading and foreground reconnection preserve the exact-bound
  signed Free/Pro selection and never erase it merely because transport is not
  ready. Online status refresh and Stripe actions wait separately for the
  provider connection to settle.
- A provider-disconnected user can inspect the current catalog without implying
  a separate TaskTime login. Trial eligibility remains unknown until a selected
  Google Drive or Dropbox session resolves canonical status. Checkout displays the exact
  catalog amount/currency/interval/tax/renewal/legal summary, reconfirms a changed
  revision, creates at most one active attempt per account, and waits for
  canonical Stripe confirmation after return. If the selected account still has
  an expired hosted Checkout attempt, the same explicit click may retire it,
  refresh canonical status, and retry once only for the unchanged offer and plan
  revision. Any changed offer returns to explicit confirmation, and product copy
  never exposes an internal billing error code.
- Starting paid Checkout sends the locally verified connected-account email only
  as an optional billing contact. Stripe Checkout prefills it for a new or
  email-less mapped Customer, while an existing Stripe billing email remains
  authoritative. The email never identifies an entitlement or trial. Checkout
  uses automatic tax and optional business tax-ID collection without forcing a
  full billing address or a separate TaskTime Terms checkbox; Stripe may still
  request the minimum location fields required for the applicable tax/payment
  flow. The final production consent and tax treatment remains a launch approval.
- On a loopback Vite development origin, Plan & Billing may use the same bundled
  review values as `/pricing/` while the public Worker catalog is unavailable.
  The Worker catalog replaces that display when available. Production builds do
  not use the fallback, and it never authorizes trial, Checkout, entitlement, or
  hosted-service work.
- Plan & Billing keeps one responsive Free/Pro comparison before and after
  canonical status loads. The verified active card carries a neutral
  **Current plan** badge beside its plan name; unresolved lifecycle state does
  not guess a current plan. Trial, purchase, recovery, and Portal actions adapt
  inside the Pro card instead of replacing the comparison with a second billing
  layout. **Manage billing** appears only for a verified subscription-backed Pro
  state; a Free, trial, or grant state does not expose it merely because a Stripe
  customer record exists, and it shows the shared loading spinner until the
  Stripe Portal navigation begins. A fixed Portal return waits until the
  selected cloud provider has finished reconnecting, then triggers canonical
  reconciliation before its URL marker is removed; the UI trusts the reconciled
  `cancelAtPeriodEnd` value, not the return itself. During that reconnect the
  still-valid device-bound plan remains selected, Pro is never replaced with a
  purchase prompt, and online billing controls show a reconnecting state. A
  transient return failure is
  retried after canonical status recovers without requiring a tab change. The
  billing UI says the browser is offline only when the browser reports an
  offline network state; a transient online Worker or session failure remains a
  billing-status error. **Refresh status** performs authenticated canonical
  reconciliation and then forces a fresh signed status read even inside the
  foreground-refresh cooldown. A pending period-end
  cancellation uses neutral **Subscription set to end** copy, names the effective
  date, and confirms that Pro remains usable until then without saying "soon."
  The purchase footer keeps the applicable tax
  qualifier only while **Get Pro** is present and leaves renewal disclosure and
  confirmation to hosted Checkout. Hosted-email
  quota authority remains at the hosted Send action and is not presented as a
  standalone billing-dashboard card.
- A permanent complimentary grant renders the Pro card as **Current plan** with
  **Complimentary Pro**, no charge/renewal wording, and no founding-price,
  Checkout-tax, **Get Pro**, or **Manage billing** controls. It remains a normal
  canonical Pro entitlement online and through the existing bounded signed
  offline assertion, without mutating Stripe, founding capacity, or one-time
  trial eligibility. An owner-only private operation resolves only the exact
  opaque account reference, previews state before mutation, writes one
  active grant and one audit event idempotently, lists retained history, and
  revokes without deleting that history. A missing/ambiguous reference, active
  identity transfer, malformed input, missing confirmation, or partial database
  operation fails without granting or revoking access. Explicit billing-profile
  deletion revokes an active complimentary grant in the same transaction and
  retains a distinct self-service revocation audit event. Local visual validation
  uses the same domain operations while remaining isolated from production.
  Issue, refresh, UI presentation, retained-history review, revoke, and canonical
  refresh back to Free are repeatable without production effects.
- The catalog contains exactly Free and Pro, with annual `EUR 39` founding and
  `EUR 59` standard offers under Pro. Founding applies to the first 250
  successfully paid canonical principals. A 251-way concurrent
  Checkout test never exceeds 250 live reservations plus committed slots;
  unpaid canonically expired reservations release exactly once, while committed
  paid slots never recycle. Reservation-only saturation remains retryable and
  does not activate standard pricing. After the 250th commit, a stale founding
  request creates no Stripe state and requires explicit confirmation of the
  `EUR 59` order summary; the resulting standard Checkout touches no founding
  slot. The same continuous/recoverable subscription retains its immutable
  founding Price, while a terminally ended founder's new purchase uses standard.
  No exact remaining count is disclosed.
- Subscription cancellation defaults to period end and shows the effective date
  and continued access. For a founder it states that reversal before then
  preserves the founding base price and warns that terminal cancellation
  permanently loses founding eligibility, so a later new subscription uses the
  current standard offer (`EUR 59/year` under the approved launch catalog). A
  standard subscriber sees no founding-specific warning and is told that a later
  new subscription uses the then-current standard catalog.
- Provider connection copy states that Google Drive/Dropbox is also the optional
  storage connection, keeps the current sync mode, returns to the intended
  surface, and requires a separate trial/purchase confirmation. Billing action
  guidance distinguishes first-time Cloud Sync setup from a previous connection
  that only needs reconnecting, and uses a visible primary cloud action on the
  neutral notice surface.
- Email recipient/subject/body/template/forwarding/PDF preparation remains Free.
  Free/over-quota users retain the draft, template editor, PDF/download, copy,
  and manual-delivery path. The hosted Send control remains visible but
  unavailable with an accessible inline reason and a separate enabled trial/Pro
  or recovery action; a disabled control is never the only explanation or
  action. Trial/purchase return restores the draft but never sends
  automatically; a fresh Send uses one durable request key and exact primary/
  forward units.
- Public catalog/JWKS caching is isolated from private no-store billing/email
  responses. Status and the signed license share one canonical entitlement
  revision; a mismatch is unavailable/retryable and never a repurchase prompt.
  Pending provider acceptance is written before Send to a privacy-minimized,
  lifecycle-bound non-Yjs attempt store and returns a D1-only automatic status-
  check path. The modal stops its loading state after a bounded interval, the
  list suppresses duplicate Send while the attempt is unresolved, and a later
  accepted result removes Send and shows Sent without user intervention. One
  byte-identical same-attempt retry remains provider-idempotent; no recovery path
  creates a second logical send. Reload/account switch/transfer never exposes or
  resends content, and only owned status proof can rebind lifecycle evidence.
  A crash between marking the terminal attempt applied and persisting Yjs sent
  metadata is recovered from that retained terminal result only while the
  matching invoice still lacks its sent timestamp. This includes primary-
  accepted/optional-forward-rejected partial completion. Terminal sent metadata
  converges once, an already-sent invoice stops polling, and a changed, deleted,
  or canceled current document is never mutated.
- Provider loss does not prevent a subscriber obtaining invoices or canceling
  through the approved Stripe-hosted login or audited support route. Provider,
  product-data, billing, cancellation, and billing-profile deletion remain
  distinct.
- Real local D1 tests prove migration rollback, operation claims, founding-slot
  contention/continuity, founding-to-standard selection/reconfirmation without
  standard slot mutation, concurrent trial/Checkout/transfer/webhook/email
  behavior, stale-lease recovery, legacy
  email cutover, the fenced cross-database transfer saga, executable clean/
  current-baseline ledgers, and representative backup/restore. Browser responses
  and logs contain none of the
  prohibited billing/provider/invoice/email payloads.

## Sync modes

- Manual mode auto-connects but does not normally pull/push without “Sync Now,” except documented pristine-device bootstrap.
- Backup mode automatically pushes pending local changes and does not automatically pull normal remote changes on focus/online triggers.
- Sync mode performs bidirectional work on documented triggers with cooldown and cross-tab locking, including a lightweight five-minute manifest check only while the app is visible.
- Genuine pending local work that encounters an active sync or occupied cross-tab lock retries after the current pass can release the lock; clean checks and failed network/conflict passes do not create retry loops.
- “Sync Now” forces a full pull/push in every mode.
- The visible sync-status control remains keyboard-operable while loading, connecting, checking, downloading, uploading, or syncing and opens Account > Cloud Sync without starting a duplicate sync.
- The client exposes Google Drive and Dropbox by default and onboarding describes cloud sync without implying that Google Drive is required. An explicit build-time false value remains an emergency UI opt-out; Worker policy still fails closed for disabled Dropbox endpoints, new connections, or transfers.
- Google Drive and Dropbox expose the same two connected-provider choices. Disconnect syncs and detaches only this browser while retaining cloud data and provider authorization. Wipe data & disconnect deletes and verifies all TaskTime sync files and backups before confirmed revocation and disconnect, while retaining local data.
- The active cloud card shows the selected provider's official mark beside its title and switches both after verified transfer activation. A visible transfer panel precedes provider settings, remains at zero until the first durable stage, reports accessible monotonic determinate progress with a reduced-motion-safe traveling highlight inside the filled line, and is removed after successful completion.
- Transfer confirmation and progress use provider names and concise plain language. Their compact title-free warning says not to use TaskTime on other devices during transfer and to connect them to the named new provider before editing.
- Opening a provider with a verified moved marker does not retry indefinitely or report a generic incident. The recorded destination is the primary recovery action and does not delete source data.
- While that moved-source choice is unresolved, global sync status says which provider the workspace moved to and opens Account > Cloud Sync; it never presents direct source reconnection as the default action.
- Choosing to use the moved source instead requires destructive confirmation, verifies and removes every TaskTime backup and sync file in that source with the marker last, leaves the destination untouched, and completes one push-only full-workspace seed from local IndexedDB. The same behavior works in both provider directions and safely resumes only from an already empty source namespace.
- Long-running Cloud Sync confirmation actions remain disabled while processing and use the shared left-aligned loading spinner with specific progress text.
- A transient provider-grant revocation, token refresh, rate-limit, or status failure keeps the retryable session and connected runtime and does not claim that access was revoked or the wipe completed.
- A direct connection keeps its access token only in active-tab memory and sends ordinary Drive file requests directly to Google. Ambiguous writes are never replayed through the Worker.

## Agent bridge

- A non-loopback bind is rejected or requires an explicitly supported safe configuration.
- An unpaired, expired, revoked, out-of-scope, over-limit, or unapproved request cannot execute a protected command.
- A paired allowed command produces the same business effect and validation as its UI counterpart.
- Session tokens do not appear in status files, launch URLs, logs, docs, or error recovery payloads.
- Refreshing a paired TaskTime tab resumes the same live bridge session without reusing a pairing challenge.
- Closing all TaskTime tabs and reopening the app in the same browser profile reconnects to the same live bridge through a fresh signed challenge and fresh app-session token, without persisting or broadcasting a bearer token.
- A reconnect proof with an expired, replayed, wrong-origin, wrong-instance, unknown, or revoked challenge/key cannot create a session; explicit disconnect/forget, revocation, expiry, or bridge/Gateway restart requires pairing again.
- Unsupported or unavailable browser credential storage degrades truthfully to current-tab recovery or explicit pairing without weakening validation.
- The managed OpenClaw integration keeps one Gateway-owned bridge across ordinary turns, detects a recognized legacy TaskTime MCP configuration instead of starting a duplicate, and leaves generic MCP/Claude stdio behavior compatible.
- The installed integration can complete the long-running task/start/work/refresh/close/reopen/stop/verify flow.
- The discovery manifest and generated tool catalog agree on core-use, privacy, and canonical first-party ClawHub metadata.

## Quality evidence

- Behavior changes start with a failing focused test and finish with the relevant Docker-backed green checks.
- Persisted, sync, billing, reporting, import/export, and agent changes include negative and compatibility coverage proportional to risk.
- Broad release-sensitive changes pass `make release-gate`.
- The repository-wide TypeScript check completes with zero diagnostics as part of `make release-gate`.
- Public agent interface changes also pass the agent bridge/bundle smoke path and update generated documentation.
