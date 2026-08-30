# Acceptance Criteria

## Local-first and compatibility

- A returning user can open an existing supported IndexedDB dataset after an upgrade without clearing browser data.
- A supported historical backup or Drive record is validated/migrated and retains valid relationships.
- Offline use allows local work; unavailable cloud actions fail visibly without corrupting local state.
- Reconnecting never silently replaces unsynced valid local work with an older remote snapshot.
- Core use does not require a TaskTime account or cloud sync, and public discovery metadata states that work records use browser-local storage.

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

## Subscription and Pro boundary (planned; production controls remain off)

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
- An eligible connected account starts one 30-day no-card trial only after an
  account-reference confirmation. OAuth/navigation/retry never starts or moves
  it. Operational rollout/canary controls never grant Pro or consume it. Early
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
  responses are ignored rather than converted into a plan decision.
- A provider-disconnected user can inspect the current catalog without implying
  a separate TaskTime login. Trial eligibility remains unknown until a selected
  Google Drive or Dropbox session resolves canonical status. Checkout displays the exact
  catalog amount/currency/interval/tax/renewal/legal summary, reconfirms a changed
  revision, creates at most one active attempt per account, and waits for
  canonical Stripe confirmation after return.
- The catalog contains exactly Free and Pro, with annual `EUR 39` founding and
  `EUR 59` standard offers under Pro. Founding applies to the first 1,000
  successfully paid canonical principals. A 1,001-way concurrent
  Checkout test never exceeds 1,000 live reservations plus committed slots;
  unpaid canonically expired reservations release exactly once, while committed
  paid slots never recycle. Reservation-only saturation remains retryable and
  does not activate standard pricing. After the 1,000th commit, a stale founding
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
  surface, and requires a separate trial/purchase confirmation.
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
  lifecycle-bound non-Yjs attempt store and returns a D1-only status-check path,
  not an automatic send. Reload/account switch/transfer never queries the wrong
  owner or exposes/resends content; terminal sent metadata converges once.
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
