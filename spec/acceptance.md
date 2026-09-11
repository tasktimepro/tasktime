# Acceptance Criteria

## Local-first and compatibility

- A returning user can open an existing supported IndexedDB dataset after an upgrade without clearing browser data.
- A supported historical backup or Drive record is validated/migrated and retains valid relationships.
- Offline use allows local work; unavailable cloud actions fail visibly without corrupting local state.
- Reconnecting never silently replaces unsynced valid local work with an older remote snapshot.
- Core use does not require a TaskTime account or cloud sync, and public discovery metadata states that work records use browser-local storage.
- Core and site install, test, and build independently, without either nested
  checkout or shared node_modules. Only core owns the app PWA and SPA fallback;
  only site owns Astro, public discovery, sitemap/feeds, and indexable public
  pages. App crawling is allowed so its noindex metadata can be observed.
- Public app-origin routes redirect to the exact site origin with query state
  preserved and never replace the offline app shell. Core routes/OAuth stay
  app-owned. Site app CTAs use the exact app origin; legacy public URLs remain.
- Site rejects invalid pinned contracts, missing assets, incorrect canonicals,
  or app-owned output. Core rejects missing PWA outputs or site-owned output.
  A new source release cannot overwrite the other product's deployment.
- Site ships a non-indexable top-level 404 without a canonical or SPA fallback;
  unknown public paths and app-only PWA resources return 404. Every public page
  has valid metadata/assets and sitemap coverage; unknown editorial modification
  dates are omitted. Only the app manifest defines install identity and scope.
- Both core release entry points and the independent site release gate stop on
  high/critical dependency findings before producing a release-ready result.
- The exact pre-cutover combined root artifact remains the rollback input.
  Independent builds and local tests do not authorize a live origin change.

## Work and time

- Users can manage clients, projects, tasks/subtasks, notes, planner attachments, and goals through the corresponding screens.
- A subtask cannot be configured as recurring.
- Two projects may have timers concurrently, but a project cannot hold two active timer states.
- Pause/resume preserves elapsed duration without creating an entry.
- Stop creates one entry for the selected task, including the correct interval/note, and clears only that timer.
- Repeating a recovered stop operation does not create a duplicate entry.

## Task and account polish

- Disable recurrence/Enable recurrence is available only in recurring-task
  three-dot menus, using calendar-off/calendar-check icons without timer pause/play
  icons. It survives reload/provider sync, excludes missed
  dates after resume, and leaves completion/skip/timer/billing history intact.
  Both actions use the same menu-item alignment and icon spacing as Edit/Delete.
  Disabled recurrence leaves task titles unchanged. Task list surfaces replace
  their normal recurrence schedule tag with a neutral calendar-off `Disabled` tag,
  and task details show the same tag inline with the repeat description in the
  Schedule section.
  An open editor cannot overwrite newer pause/resume state, and a stale menu
  action cannot reverse an already completed action.
- Category add/edit uses a separate modal and the existing Color Tag picker.
  Its action is aligned opposite the active-category heading and the form is
  wider than a standard small form. Original colors and neutral fallbacks are
  consistent across selectors, expenses, Planner, reports, and category summaries;
  expense cards use the category-colored left border without a duplicate dot.
  Compact category labels stay within fixed card/row widths, ellipsize when needed,
  and retain the full name in a native title tooltip.
  Uncategorized Planner expenses retain a neutral left border without falling
  back to project or client colors, while expense rows without that border use
  an 8px category dot. Archived
  history retains identity. Deleting a referenced category opens an immediate
  dialog with its usage and Archive guidance rather than placing feedback at the
  top of the scrollable manager.
- Expense records store `categoryId`; changing the referenced category's name,
  group, or color updates every rendered reference without rewriting expenses.
  Saving an edited recurring expense prompts about existing instances only when
  its category changed. `Future expenses only` leaves them unchanged; the
  counted update changes only instances from that recurrence that still match
  the previous category, preserving manual category overrides. Other recurrence
  field edits stay future-only and never open this prompt.
- Expense forms show `Manage categories` beside Category. Opening and closing
  the nested manager restores the same expense editor and all unsaved form
  values. Drafts are matched to the exact expense or recurrence and are cleared
  after save, delete, intentional close, or the category-propagation choice;
  opening another recurring expense starts from that recurrence's saved data.
- Sidebar expansion never wraps the title; the full title fits once expanded.
- Shared three-dot action menus leave page scrolling available while open. They
  remain open through up to 8px of incidental movement, close after the trigger's
  scroll position moves farther, and retain normal keyboard and focus behavior.
- Account Sign in includes the standard sign-in icon and its provider choices
  use the same primary buttons as Cloud Sync.
- Project Billing & Timer Rules and Project Planning remain hidden until a
  client is selected.
- Account sign-in opens provider choices without requiring a Cloud Sync tab
  visit. Progress, errors, offline/duplicate attempts, retained-provider recovery,
  successful connection, and keyboard focus return are covered.
  Retained Dropbox retries preserve the session and update the sync consumer;
  errors after successful authentication remain visible.
- Project billing/planning sections collapse without losing values; hidden
  validation errors expand the section. Flat-rate overrides remain reachable.
  Missing inherited hourly rates show guidance and focus the override control;
  zero hourly overrides cannot silently block a collapsed form.

## Dashboard regression boundary

- Project names show a 14px folder outline in the original project color,
  inheriting the client color when absent and otherwise falling back to neutral.
  Icons are decorative, and the client/pending-time line aligns with their left
  edge; project-name click and keyboard navigation remain intact in both themes
  and on phones. Existing client links, pending values, search/filter behavior,
  and empty states remain intact.
- Planner project attachments use the closed-folder project icon while deadline
  markers retain the flag icon. Planner projects without a resolved project or
  client color keep the same 4px left accent using the neutral border token.
  Expense items use a left-only dotted 4px accent while every other card edge
  remains solid; category colors and the neutral fallback remain unchanged.
  The Projects page has one decorative project
  icon beside its main heading using the neutral muted-foreground token, keeps
  individual card headings text-only, and
  uses the same 24px active/archived grid gap as Clients. Project detail shows a
  folder beside its title using project color, inherited client color, or the
  neutral fallback, without changing persisted data.
- Project cards match Client card padding at phone and desktop breakpoints.
  Status tags sit immediately after the title, while the vertically aligned
  three-dot action remains at the far right. The creation date remains visible, while the Most recent
  label/date is omitted without removing recent-activity sorting. Project-list
  and client-dashboard project cards place details in a flexible left column
  and invoice/deadline pills in a right-aligned column on the same row, wrapping
  only when the available card width requires it.
- The Clients page shows the shared users icon beside its main heading using the
  neutral muted-foreground token. Client
  detail shows the Planner's single-user icon beside the client title using the
  client's valid color or the neutral fallback. Client names inside project cards are keyboard and
  pointer accessible, underline on hover/focus, and navigate to the client
  without opening the surrounding project card.
- Project and client list headings hide only their parenthesized totals below
  the `sm` breakpoint while preserving their icons, titles, sort controls, and
  create actions.
- Project and client dashboard Unbilled cards match the leading-icon,
  title/value alignment, typography, padding, and responsive behavior of the
  adjacent metric cards. An available unbilled-expense total remains a secondary
  line within that same content column.

- Today and Upcoming retain task/recurrence/timer/expense actions. Upcoming is
  visible without expanding Today, its header omits a redundant seven-day
  subtitle, and more than five items remain accessible.
- When one task has an unpaused timer, other tasks in the same project cannot
  open the task-details modal from Today, Upcoming, or the Dashboard Tasks card.
  Their title controls are natively disabled and overdue dates do not remain an
  alternate details link. The timer-owning task, other projects, and paused
  project timers remain interactive.
- A running task timer uses the same animated danger-color dot in Planner and
  the global timer; the indicator exposes a non-color accessible label.
- At phone widths, Today and Upcoming precede horizontally scrollable summary
  cards in DOM order, with no page overflow. Desktop uses adjacent action panels.
- Daily billable plus non-billable actual duration equals the selected-period
  tracked total, including zero days and archived work; billed snapshots do not
  inflate actual hours. Current summary timeframes survive report-period changes.
- A standalone task moved into a no-client/personal project remains non-billable
  in saved/live dashboard time, report hours/exports, and unbilled summaries even
  with a retained `billable: true` flag. Removing/reassigning a client refreshes
  classification immediately without changing actual duration or saved records;
  archived client work and explicitly non-billable client tasks remain correct.
- Recording time on standalone, no-client, or personal tasks does not
  automatically set their billable preference. Client work retains automatic
  marking and respects an explicit non-billable preference.
- Moves to another client's project, a personal project, or standalone work
  preserve sent/paid invoice details, entry claims/rates, actual intervals,
  billing increments, and task cutoffs. Later unbilled work follows the current
  destination. Canceling an eligible unpaid invoice releases only its claims
  without moving the task back; paid cancellation remains refused.
- Draft finalization refuses changed source project/client/billability before
  applying entry claims. Legacy merged-task time remains excluded from new
  invoice previews/selectors and uninvoiced report hours after a task moves.
- Running timers increment only dashboard tracked-time displays once per minute
  while visible, with immediate lifecycle/focus refresh and frozen paused time.
  Period and local-start-date rules apply to concurrent and cross-midnight
  timers. Live ticks cause no Yjs writes or financial recalculation; saved
  stop identities suppress duplicate contributions, including legacy timers.
  Stop/reload preserves the actual total and creates one entry.
- Reports match chart and metric-grid heights on desktop, align the legend with
  the title on the right, and omit duplicate chart totals/trends, the upcoming-
  expense note and visible daily dropdown. The Y-axis ceiling is
  `max(8, ceil(largest daily stacked hours))`.
- Trends compare the preceding calendar month or preceding 90 days, loading
  relevant archived years. Zero baselines never produce infinite percentages;
  currency failures never produce a comparison across incompatible amounts.
- Dashboard remains usable when exchange rates finish loading successfully and
  when a page reload reads cached rates; conversion-warning checks use only
  current report fields and preserve frozen payment amounts.
- Paid timestamps, frozen conversions, mixed-currency failure, canceled/legacy
  invoice eligibility, rapid period changes, loading failures and retry have
  regressions. A legacy invoice arriving later refreshes required source years.
- A production PWA can open the dashboard and its chart offline after installation,
  even if the dashboard was not visited online. Cache matching may ignore Vary
  only for same-origin `/assets/` URLs in the generated build manifest; other
  requests retain existing cache/privacy behavior.

## Expenses overview regression boundary

- The existing Outstanding/Upcoming/Paid tabs, expense rows, sorting, date/status
  scopes, and payment/edit flows retain their behavior and presentation. Older
  unpaid expenses remain visible in Outstanding when a newer period is selected.
  The desktop status-tab strip retains horizontal overflow without a vertical
  scrollbar.
- Selected-period spend, category amounts, and matching monthly bars reconcile
  saved paid expenses by expense date, excluding future automatic payments and
  previews. Marking an older expense paid does not move its expense date.
- Frozen payment FX values win over live rates. Unavailable conversions retain
  separate currencies and cannot produce false combined charts or trends.
- Recurring estimates normalize annual schedules and disclose unknown variable
  amounts; Upcoming totals use the same records and previews as the existing tab.
- The complete Recurring expenses and Upcoming payments cards activate their
  existing destinations by pointer or keyboard, without separate bottom links.
- History loading/failure cannot display partial overview totals as final; retry
  restores the view, and nested archived-record updates refresh it.
- Phones keep original list actions ahead of the analytical panels, with a
  horizontally scrollable summary rail and no page overflow at 320px. Desktop
  places the analytical panels above the original tabs/list.
- Chart values are keyboard and screen-reader accessible. An installed production
  PWA can first visit Expenses offline and load its chart without a prior online
  Expenses visit. Activity opens the original record and never claims money was sent.
- Recent activity stays at three widget rows. Show more opens the shared modal
  for today and the preceding 29 local calendar days, excluding older recorded
  activity across month/DST boundaries; the card retains its upcoming hint.
  Opening the modal never stretches the panels. Padded rows show a pointer
  cursor and the shared blue name on hover/focus. Expense details return to the
  modal, and closing it restores focus to Show more. Long lists scroll inside
  the modal at desktop and phone widths.

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

- First Reports navigation after a shared-modal development hot update must
  retain the mounted Yjs and billing providers, local records, and report-access
  decisions. Browser smoke coverage exercises this with Reports enforcement
  enabled and catches React ErrorBoundary errors as well as unhandled errors.

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
  Worker, Stripe test-webhook listener and optional site as one detached
  `tasktime` Docker Compose group (app 3101, site 3102). Every Worker control
  enabled in tracked production configuration stays
  enabled locally, while guarded unreleased billing behavior may be enabled only
  against local state and Stripe test mode. Preparation fails with a sanitized,
  actionable error when the ignored local Resend credential is absent. Stopping
  the group preserves all containers and data for Docker Desktop Play. Independent
  validation in `tasktime-tools` does not stop the group. The billing-specific
  target remains a compatibility alias; a public checkout without private infrastructure retains
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
  On Overview, a rocket-led **Get Pro** action aligns opposite the title only
  when the same shared decision used by Plan & Billing exposes a purchase or
  fresh-account comparison path. It is absent for verified Pro, reconnecting,
  offline, unresolved connected-account, suspended, and permanent-grant states.
  Each locked advanced preview consumes that same decision and the shared plan-
  plus-connection state: a fresh account-free browser says **Get Pro to unlock**
  the selected report and routes **Get Pro** to Plan & Billing; an earlier
  account that needs manual reconnection routes **Reconnect Cloud Sync** to the
  sync section; automatic reconnection shows non-actionable progress; and an
  offline browser asks the user to go online. None of those temporary states is
  flattened into a generic account-confirmation prompt.
- `get_report_summary({scope:"basic-current-month"})` is Free and returns only
  the closed versioned three-metric Overview contract. Omitted scope compatibility-defaults to
  `advanced`; advanced summary and all report CSV/PDF/accountant-pack exports
  require `reports.access`, branching before `collectReportsData()`. All seven
  tax-period/expense-claim commands remain Free and expose no report aggregate
  through that path.
- Free allows a first active client, including in a fresh browser before plan
  status resolves because that slot is available on every plan. At the limit, every browser and agent
  create/unarchive path refuses only the net-increasing transition with the same
  typed policy; archiving frees a slot and upgrading never auto-replays the
  action. Idempotent replay is resolved before counting. Downgraded, imported,
  restored, synced, or concurrently merged over-limit clients remain visible,
  editable, usable, archivable, deletable, exportable, and recoverable without
  silent correction.
  A queued browser or agent create/unarchive re-reads the current entitlement
  after taking the application lock, so a downgrade, expiry, or account change
  cannot authorize a second client using an earlier Pro snapshot. Client-limit
  and hosted-email notices use the same upgrade/status/reconnect/offline
  recovery classification as the locked Reports previews; the fresh browser's
  second client offers Pro rather than asking to confirm a nonexistent account.
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
  Every page reads the same derived plan-plus-connection state, so temporary
  transport loss changes online-action guidance without changing a still-valid
  Free/Pro selection or creating a repurchase prompt.
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
- A verified local plan expires at its signed deadline even in an already-open
  tab. Foreground wake rechecks suspended timers, clock rollback deselects the
  cached binding, and in-flight response/key verification time cannot extend
  access. Non-finite clocks fail closed. Offline verification keeps bounded
  cached public keys beyond HTTP freshness without bypassing signature, subject,
  or expiry checks. Failed/offline/disconnected status reads remove stale
  Checkout/trial/Portal/usage projections but preserve valid local Pro. A late
  account response, billing redirect, or cache cleanup cannot affect a newly
  selected account.
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
  When a still-valid Pro assertion is available but the hosted-service lifecycle
  is not ready, the modal identifies Pro as available instead of prompting for
  an upgrade. An offline browser says to go online without offering an unnecessary
  reconnect; an automatic reconnect shows non-actionable progress; an absent,
  manually disconnected, or mismatched lifecycle offers **Reconnect Cloud Sync**.
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
