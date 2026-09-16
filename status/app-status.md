## September 16 final email-stage browser fixture

Hosted-email Worker policy is live; signed production status confirms available
Pro quota 100. Reports is also live with 25 route/byte checks and isolated Free
Overview, advanced-tab gating and offline recovery proof. Final browser-artifact
preparation exposed an older smoke expectation for the pre-policy cloud prompt.
A focused red run reproduces that assertion; the corrected test explicitly covers
both policy modes, retained draft fields and zero send requests. No runtime or
agent artifact changes are required. The full final artifact gate must pass
before enabling the browser email flag or publishing the core release tag.

## September 16 client-stage production deployment

Core `2ba528f` is promoted to main and live at `app.tasktime.pro` with client
limits enabled. The exact staged artifact passes 2,888 unit tests (one existing
skip), all 96 Chromium journeys, five PWA checks and static/build checks. All
25 live route/asset/TLS checks pass. Edge shows the expected four active clients
under the confirmed Pro trial and Dropbox in sync. One explicit status refresh
makes one GET (plus its CORS preflight), returns 200 and produces no conflict.
Reports and hosted-email enforcement remain separate pending stages. The public
root now serves the approved site with its readonly migration recovery reader.

## September 16 enforcement-enabled agent fixture correction

Client-stage preparation `35068126974` exposed three command tests that assumed
synchronous, unguarded client writes. Their shared fixture now supplies an
explicit Pro grant and awaits client commands in both flag modes. Duplicate and
identity assertions remain intact, and separate Free/unresolved/concurrency
policy tests remain enforced. All 92 command/policy tests pass with client,
report and email enforcement enabled; lint/typecheck pass. This is test-only
and changes no published agent artifact or app release version.

## September 16 billing refresh correction

The deployed preview exposed a duplicate status request after normal account
refresh/trial actions. The announcer used a separate BroadcastChannel instance,
so its own mounted listener also refreshed. A red regression reproduced two
requests; sharing the sending/listening instance now preserves other-tab updates
without receiving its own announcement. All 38 focused context/status tests,
changed-file lint and core typecheck pass. This compatible runtime fix stays in
the unreleased 1.6.0 app train; no packaged agent content changes. Full artifact
validation and deployment remain pending for this correction.

# App Status

## September 16 billing-enabled release fixture correction

The billing-enabled release gate passed 2,887 unit tests and 95 of 96 browser
checks. The direct Google transport test treated the catalog effect's intentional
StrictMode/reload cancellation as a sync failure. The direct-drive fixture now
returns a deterministic unavailable billing API response instead of contacting
the live Worker. The test excludes only that exact catalog cancellation, retains
all provider/non-cancellation errors, and checks failures again after uploads.
It also verifies the billing fixture was exercised when billing UI is enabled.
Both affected Chromium journeys and focused lint pass; the full release
preparation is being rerun. Production runtime and published agent contents are
unchanged, so the existing core 1.6.0 release train and site pin remain valid.

## September 15 production continuation authorized

The owner approved launch continuation, including root publication and the
retained Cloudflare rollback fallback, with no new expenses and cleanup deferred
until verification. The core 1.6.0 candidate below is being frozen for clean
contract/recovery pins and final CI. No agent artifact contents changed. Source
checkpoint approval does not mark the remaining device, commercial-availability
or production canaries complete; their evidence belongs in the private runbook.

## September 15 temporary root recovery — local candidate validated

`src/recovery/localWorkspaceRecovery.ts` reads only existing old-origin Yjs
updates and decodes them in memory. It reuses the normal portable-backup parser,
includes local archive documents and rejects ambiguous/partial state. It never
creates a database, starts persistence/sync, exports credentials or mutates source
records. Full core gate passes 2,887 unit tests (one existing skip), 96 Chromium
checks and five PWA checks, with audit/lint/typecheck/coverage/build/contracts.
The 17 recovery unit tests cover all five supported sample backup fixtures,
concurrency, pending operations, corrupt data and unfinished timers. All 15
targeted browser tests pass across Chromium, Firefox and WebKit, including a real
YjsStore import on the separate app origin. Recovery coverage exceeds the 75%
per-file requirement. Evidence: `/private/tmp/tasktime-phase4-recovery-core-gate.log`,
`/private/tmp/tasktime-recovery-browser.log` and
`/private/tmp/tasktime-recovery-coverage.log`.

The standalone bundle builds successfully and is locally pinned in the site as
a dirty candidate. The site now uses it for real downloads; its release gate and
the retained old-worker online/offline/reopen rehearsal pass. Final clean pins,
private checkout access, rollback decision and root-profile retirement remain
release work. No agent artifact changed, so no agent package republish is needed.
This remains the core 1.6.0 launch train, with independent site/infra revisions.

## September 15 Phase 4 preflight — validated, awaiting branch commit approval

The app-origin Google disconnect issue is reproduced and fixed locally. Every
mounted auth consumer now clears its signed-in identity when the shared stored
session is removed; account sign-in and cloud connection buttons return without
reloading. No local work is reset or remote grant revoked. The regression, all
92 related tests and a Chromium disconnect journey pass. Changed-hook coverage:
87.79% statements, 76.49% branches, 89.85% functions and 88.39% lines.

The final complete Docker app gate passes: 287 files / 2,870 unit tests plus one
existing timezone skip, 91 Chromium checks, five PWA checks, zero audit findings,
lint/typecheck/coverage/build/contracts. All 790 installed tooling packages match
the lockfile; five private app/site deployment guard tests pass. Logs:
`/private/tmp/tasktime-phase4-final-core-gate.log`,
`/private/tmp/tasktime-phase4-disconnect-green.log`,
`/private/tmp/tasktime-phase4-disconnect-browser.log`.

Fresh Cloudflare/GitHub reads confirm the deployed app and old root are unchanged,
paid controls remain off and required Stripe/licence bindings are not installed.
Core stays public, nested site/infra private and ignored; queried branches are
unprotected. The reviewed public snapshot needs a clean core commit before the
site can pin it. The next proposed step is separate update/launch commits/pushes
and CI/artifact preparation, preserving the earlier no-commit boundary until
explicitly released. No agent artifacts changed in this follow-up. Main promotion,
production billing, root publication and cleanup remain separate decisions.

## September 15 invoice VAT and receipt setup

The owner subsequently chose to leave Stripe Tax registrations unchanged for now.
Registration setup is deferred; live billing remains disabled.

Owner supplied the invoice VAT number; it is now added and verified in the
correct TaskTime Pro live Stripe account. Invoice-default selection, receipt
emails await confirmation of the earlier Dashboard steps. The owner has now
confirmed completing payment recovery: eight attempts over two weeks, final
cancellation, invoice left overdue and failed-payment emails. The API still
reports no TaskTime Tax registrations; an invoice VAT ID is present. The optional first-purchase thank-you copy and delivery contract are
prepared privately; its runtime implementation remains a follow-up. No email
was sent, no code committed, and no Worker/app/site deployment occurred.

## September 15 approved launch policies — local validation complete

The owner approved 100 hosted messages per UTC month, seven-day paid-renewal
grace, 14-day refund requests on annual purchases/renewals, a two-business-day
support response target, 30-day completed-delivery reference retention and
1,095-day trial markers. Local review pricing and the private sandbox now use
the approved allowance; the sandbox also uses the approved grace/retention.
Existing session/signing keys and customer workspace data were preserved.

The Worker removes expired trial markers in bounded sweeps and anchors renewal
markers to first activation. Expired markers are not recreated by identity
transfer. Billing history and accounting records are retained separately;
no blanket tax-data deletion was added. Red/green real-D1 regressions pass.
Validation: all 40 Worker files / 384 tests plus typecheck, the focused core
pricing test, and the site gate (10 native tests, 15 browser tests passed; the
optional token-dependent diagnostics canary was skipped). Local Worker health,
catalog and supported Dropbox auth-status endpoints return 200; the catalog
shows 100 monthly emails and inclusive EUR 39/59 annual offers. Scheduler and
listener remain running. Evidence: `/private/tmp/tasktime-policy-worker-gate.log`,
`/private/tmp/tasktime-policy-core-test.log`, `/private/tmp/tasktime-policy-site-gate.log`.

Updated legal/pricing drafts remain unpublished, version 2026-09-15. The private
candidate records owner-selected settings and refreshed draft hashes with
activation false. The pinned site snapshot needs an immutable core refresh after
an authorized commit. Invoice-default/receipt confirmation and the separate
Stripe Tax registration remain open; recovery settings are owner-confirmed. Shared Resend capacity is owner-managed by explicit
September 15 follow-up and is no longer a separate approval hold. Stripe Dashboard in Edge needs
owner sign-in. Nothing committed, pushed, deployed or enabled in production;
`tasktime.pro` still requires the owner's separate go-ahead.


## September 15 diagnostics and inclusive-price follow-up — uncommitted

The owner explicitly requested leaving this follow-up uncommitted while replacing
the site's social artwork. The existing app SDK and transitive DebugBundle packages
already resolve to npm's latest `1.7.1`. App diagnostic service naming is now
`tasktime-app`; its existing hosted project was renamed with ID/history preserved.
Local review offers now say Tax included, with a changed review catalog version.
New Worker acquisition policy requires inclusive Stripe Prices; historical catalog
and signed state remain readable. Paid production controls remain off.

Validation: full core gate passes 286 files / 2,865 tests plus one existing timezone
skip, 90 Chromium checks, five PWA checks, audit/lint/typecheck/build/coverage and
contract export. The additional local review-price regression passes separately.
The private Worker passes 374 tests and typecheck, including the subsequent
inclusive-price reconciliation regressions. The separate site's full gate
passes with its own SDK, diagnostic canary and 1200×630 social metadata. Source
changes are not deployed. The original root site is unchanged. The owner's
replacement JPEG passes the separate site's full gate and metadata checks.

The previous main follow-up was explicitly approved and pushed at `bcaac6b` before
this new work. Live Stripe write access is resolved: both annual Prices and the
account default are inclusive. Stripe now verifies TaskTime Pro's trading name,
business tax details, head office and active SaaS Tax settings. Invoice tax-ID
and registration setup remain open. The customer Portal is prepared and licence
keys are locally verified but not installed; live billing stays disabled.
The owner completed a synthetic Stripe test payment, but its isolated lifecycle
rehearsal failed before webhook/projection acceptance. Reconciliation still
required legacy Price lookup names; it now recognizes configured immutable Price
IDs while retaining amount/currency/offer checks and the actual lookup name for
audit. Red/green contract and D1 regressions pass for legacy and inclusive names;
the complete inclusive-price real Stripe test-mode lifecycle now passes, including
both Checkouts, webhook reconciliation, Portal cancellation/return, renewal and
failed-payment recovery, disputes and cleanup. This remains isolated test evidence.
The local Worker and scheduler were restored without data/session resets. Edge
now loads Plan & Billing for the connected Dropbox account with its existing
complimentary Pro access. This access is separate from the synthetic payment.
Cloudflare monitoring was explicitly deferred. Operational evidence and mappings
stay private.

The owner observed a short-lived `409` on `/billing/status` after Checkout return.
The exact historical response body could not be recovered from Edge. The
retryable account-operation path reproduces an immediate warning while already
retrying; it now stays quiet during the existing two bounded retries and warns
on exhaustion. Other conflicts still fail visibly, signed local access remains
usable, and stale online actions/usage are withheld. Red/green regressions and
all 69 related billing tests pass; changed-hook coverage is 93.65% statements,
85.92% branches, 91.89% functions and 97.88% lines. Core typecheck/lint pass.
The original browser request is not proven to have this exact response code;
the change is verified against the explicit retryable account-operation contract.
Two subsequent real Edge visits to the local `checkout=success` return route
settled to the connected Dropbox account and complimentary Pro, cleared the
return parameter, and produced no captured warning/error console entries.
These checks reused the return handler without another payment. They do not
prove that a short-lived 409 can never occur: server account-operation fencing
remains in place, and the frontend change controls bounded retry presentation.
Nothing was committed or deployed, and production billing remains disabled.

The owner accepted the return test and asked to continue preparation. A fresh
TaskTime-only Stripe read confirms active inclusive EUR 39/59 annual Prices and
the configured live Portal. Registration and invoice tax-ID lists are still
empty; owner questions for VAT details, live email allowance and paid grace are
pending. Retention and final legal/publication choices remain outstanding.
The review also reproduced trial activation unconditionally rejecting production
despite an approved rollout and explicit retention. It now accepts local or
production with the required configured retention; rollout gates and invalid/
missing-retention rejection remain intact. Ten focused API regressions and the
complete Worker gate pass: 40 files / 384 tests plus typecheck. No live trial,
secret installation, commit, deployment or root-site change was performed.

## September 15 staged launch execution

App `1.6.0` is live at `https://app.tasktime.pro`, deployed from exact core
`fa2287039a8159eb9147b647a396e498f67d6253` by the private app-only workflow.
The original root deployment and DNS are unchanged. Root publication, the
returning-user recovery notice and owner data acceptance remain separate gates;
only an explicit later owner go-ahead permits the root switch. No tag or agent
package has been published.

The successful artifact gate passes 286 files / 2,865 unit tests plus one
existing timezone skip, lint/typecheck/coverage/build/contracts, zero audit
findings, all 90 Chromium scenarios and five PWA checks. One long manual-sync
journey required a retry, passing at 59.7 seconds after two total-budget timeouts.
The two dashboard journeys pass with their total budget increased to 180 seconds;
assertions and individual assertion deadlines are unchanged. A separate test-only
follow-up gives the long sync journey the same budget; both focused convergence
checks and lint pass. That follow-up is not part of the deployed `fa22870` artifact
and requires no application rebuild, version bump or agent artifact release.

All 24 live artifact checks pass. JavaScript, CSS and other checked assets match
the retained archive bytes; served HTML matches after removing only the identified
Cloudflare challenge script. Real Edge tests pass Google consent/callback and
initial sync, plus Dropbox connection and explicit Sync Now. Google showed an
empty test workspace; Dropbox restored its saved sync preferences. These bounded
test-account checks do not substitute for owner acceptance of existing data and
normal invoice/timer workflows.

Google's non-destructive Sync & disconnect completed and retained local data.
The same tab then showed stale account text and hid both connection buttons until
the app was reopened. Track and reproduce this UI state issue before root
promotion; no data reset was used. The final test tab remains connected to Dropbox.

Core main remains `9ab3daa`; its automatic CI passed. Automatic approval review
rejected pushing the subsequent test-only changes to main because of the deferred
root promotion boundary. The app was instead prepared from `update/launch`.
Further main follow-up requires explicit approval and must not deploy the root.
The compatible shared Worker upgrade and additive migrations are complete, with
legacy-value comparison, retained private backups and live origin checks passing.
Exact operational pins and rollback limits remain in the private readiness record.

## September 15 main integration

The app `1.6.0` candidate preserves main releases `1.5.1` and `1.5.2`, including
invoice time precision, serialized numeric values, explicit zero rates and
compatible legacy task-copy reconciliation. It also retains editable saved
drafts and canonical item pricing from the launch branch. The old quantity-save
regression now uses Save Draft and still checks the stored quantity and total.
The isolated merged checkout passes all 309 focused invoice checks and the full
Docker release gate: zero audit findings, lint/typecheck, 286 files / 2,865 unit
tests with one existing timezone skip, 90 Chromium checks, five PWA checks,
build/artifact validation and contract export. Evidence is retained in
`/private/tmp/tasktime-main-merge-release-gate.log`. Main promotion is authorized;
production Worker/app deployment still depends on its separate preflight.

## September 15 launch preparation — branch checkpoint

Core version `1.6.0` and the DebugBundle browser SDK `1.7.1` update pass the full
Docker gate: zero audit findings, lint/typecheck/build and coverage gates, 2,815
unit checks with one existing timezone skip, 90 Chromium and five PWA checks.
The packaged/live local agent gate also passes. Logs are
`/private/tmp/tasktime-launch-core-gate.log` and
`/private/tmp/tasktime-launch-agent-gate.log`. The owner authorized committing
and pushing this preparation to `update/launch`, followed by GitHub CI. This
authorization excludes main promotion, tags, package publication and deployment.
The user's pre-existing `TODO.md` edits are preserved outside the commit.
The independent site's contract pin still refers to its existing clean core
checkpoint and needs review after the final core commit before site publication.

Private preparation now includes a tested deployed-Worker overlap rehearsal
and a shared app/site workflow with separate prepare/deploy runs, exact artifact
approval and fixed targets. The owner-approved database rollback copies are
retained privately and pass local SQLite plus Cloudflare-runtime restore and
additive migration checks with all legacy values preserved. The owner confirmed
the Google/Dropbox app-origin additions; live sign-in remains to be checked.
Production preparation remains gated on migration/configuration
and rollback evidence, and the exact deployment decision. The app origin is first; the root
site and temporary returning-user export notice remain later work requiring
separate root-switch approval. Operational details stay in the private launch
readiness record.

## Current focus

- [x] Final local audit and user-authorized commit checkpoint (2026-09-14).
  The reviewed scope includes saved invoice drafts/UI-agent parity, timer start
  validation and Today/Yesterday editing, Planner menu space, the restored
  Unbilled cards, and independent homepage screenshots. Earlier dated
  `uncommitted` and no-commit notes below describe their original validation state.
  Audit regressions exposed and fixed client-only expense drafts losing eligible
  work during Refresh Work, and new unsaved invoice previews looking issued.
  Refresh now shares project/client expense eligibility, period and currency
  checks; missing conversion data leaves the draft unchanged. Finalizing bills
  only selected sources, so omitted eligible work remains available for a later
  invoice whose selected period includes it. Preview never issues an invoice.
  Phone footer Close remains hidden to fit Save Draft/Finalize; the header close
  control and all footer actions are verified at 320px.
  The full Docker release gate passes: zero audit findings, lint, typecheck,
  282 files / 2,815 unit tests and per-file coverage, 90 Chromium browser checks,
  5 PWA/offline checks, build/artifact validation and public-contract export.
  The one UTC DST skip passes in a separate 50-test Ljubljana timer run. All
  40 focused Firefox/WebKit draft/timer/Unbilled scenarios pass; one WebKit
  navigation crash in the combined run passed three consecutive isolated reruns.
  `release:agent` passes canonical/native builds and local bridge/bundle/live MCP
  journeys. A new bundle gate first reproduced stale vendored bytes, then passed
  after both packages were synchronized byte for byte with the canonical build.
  Final lint/typecheck pass after that guard and metadata reconciliation.
  Evidence: `/private/tmp/tasktime-final-audit-core-gate.log`,
  `/private/tmp/tasktime-final-audit-browsers.log`,
  `/private/tmp/tasktime-final-audit-webkit-retry.log`,
  `/private/tmp/tasktime-final-audit-timers-tz.log`,
  `/private/tmp/tasktime-final-audit-agent.log`, and
  `/private/tmp/tasktime-final-audit-bundle-green.log`.
  Core release scope is the planned `1.6.0` minor plus changed bridge/MCP metadata,
  OpenClaw and Claude artifacts; versions remain unpublished candidates until
  Phase 4 release preparation. Site and infrastructure have separate commits and
  gates. No push, tag, package publication, deployment or real-data change is
  authorized by this local checkpoint. See `TODO.md` for remaining launch gates.

- [x] Restore the original Unbilled dashboard layout (local/uncommitted).
  Per the user's reference, both project and client cards show the heading
  above small left-aligned icon/amount rows, with expenses beneath work when
  present. Visible Work/Expenses labels are removed; screen-reader labels
  remain. Original spacing and font sizes are restored, and mobile cards stay
  equal in height. The updated regression failed before restoration. All 27
  dashboard unit tests pass with 100% shared-component coverage; all 12 browser
  checks pass across Chromium, Firefox and WebKit in both themes and at mobile
  and desktop widths, including no expenses, expense-only and multiple-currency
  states. Screenshots were inspected against the reference. Lint, typecheck,
  local app build and diff checks pass. No commit or deployment.

- [x] Saved invoice drafts in UI and agent workflows (2026-09-15,
  local/uncommitted). Optional Save Draft supports incomplete preparation beside
  Finalize Invoice. Drafts has Continue Draft, explicit Refresh Work and confirmed
  Delete Draft; preview/PDF are marked unissued and send/payment actions require
  finalization. Reopening retains selected sources, currency, prices and manual
  adjustments. Refresh resets linked work deliberately. Shared operations guard
  stale editors, pending operations, complete historical sources, line totals,
  source conflicts and automatic/manual numbering; drafts have no billing,
  project-link or sequence side effects. UI composer and canonical agent shapes
  remain compatible, with one additive optional `draftNumberMode` field.
  Regressions cover partial drafts, later tracked work, hourly/flat/merged work,
  percentage/fixed discounts, expenses across projects, changed/deleted/billed
  sources, property-order-independent stale checks, archived numbers and reload.
  Docker `make release-gate` passed: 282 files / 2,813 unit tests, one existing
  timezone skip, per-file coverage thresholds, audit/lint/types/build/artifact
  checks, 82 browser smokes and 5 PWA/offline checks. All 18 draft browser checks
  passed across Chromium/Firefox/WebKit at 1440px/light and 390px/dark; legacy
  backup import/preview also passed across all three browsers. `release:agent`
  passed with real MCP draft edit/refresh/delete/finalize/cancel calls and both
  matching vendored bridges. Evidence: `/private/tmp/tasktime-drafts-release-gate-final.log`,
  `/private/tmp/tasktime-drafts-firefox-webkit-final.log`, and
  `/private/tmp/tasktime-drafts-agent-gate-final.log`. Generated public contract
  was exported locally; site snapshot promotion and release versioning remain
  part of a separately approved release. Earlier Planner/timer/site work is
  preserved. Nothing was committed, published, deployed or changed in an
  installed agent or the user's active data.

- [x] Simplify the timer editor to Today/Yesterday (2026-09-14,
  local/uncommitted). The user approved replacing the unrestricted calendar
  with a Start Day choice and live interval/duration preview. Existing older
  dates remain selectable, and absolute local draft dates survive midnight,
  month/year boundaries and reload. Running previews advance to now; paused
  previews preserve their endpoint. Invalid/future starts and starts after the
  paused endpoint disable saving and display a compact Notice with an alert
  icon and existing light/dark danger tokens. Older work is directed to manual
  time entries. The shared UI/agent validation and persisted timer contract
  remain intact.
  Six new editor regressions failed before implementation. Browser checks also
  exposed an existing TimePicker bug: focusing and leaving an untouched field
  reset it to zero. Three regressions reproduced that failure; only explicitly
  cleared fields now reset on blur. All 96 focused Ljubljana tests pass with
  coverage above the required thresholds, including midnight, DST, exact
  note-only timestamps, paused endpoints, keyboard/clear/clamp behavior and
  complete-history validation. All 18 desktop/mobile checks pass in Chromium,
  Firefox and WebKit, including edit/reload/stop, archived overlaps and both
  notice themes; text contrast is at least 4.5:1 and icon contrast at least 3:1.
  The final full coverage gate passes 280 files / 2,788 tests with one UTC DST
  skip covered by the focused Ljubljana run. Final lint, typecheck, app build
  and diff check pass. No schema migration, commit or deployment.

- [x] Harden timer start-update validation (2026-09-14, local/uncommitted).
  The reported August/September case is reproduced: the selected date is used,
  but changing only a paused timer's start retains its September endpoint and
  therefore can overlap September work. A timer actually paused in August is
  validated only through that August endpoint. The user chose to simplify the
  quick editor to Today/Yesterday with a duration preview, keeping the existing
  start-only semantics; see the editor follow-up above.
  The audit found real boundary gaps: four UI/agent regressions confirmed that
  direct updates accepted future starts and missed archived overlaps. Both now
  share complete-history validation, archived-task scope, a fresh timer check
  after asynchronous loading, schema validation and one Yjs transaction. The
  editor awaits success, preserves failed drafts, correctly scopes standalone
  tasks, and allows note clearing without changing/revalidating the interval.
  All 12 desktop/mobile date-edit/reload/stop checks pass in Chromium, Firefox
  and WebKit. The full standard coverage gate passes 280 files / 2,773 tests
  with one timezone skip; the final schema guard passes the focused 66-test
  Ljubljana suite without skips. useTimers coverage is 96.21% statements,
  79.77% branches, 100% functions and 97.22% lines; the shared update module is
  96.66% statements, 85.18% branches and 100% functions/lines. Lint, typecheck
  and the app build pass. The full suite under Ljubljana time also reproduced
  six existing failures in expense metrics, notification-date fixtures, the
  agent report summary and recurring-expense creation on the unchanged HEAD
  baseline; unrelated async approval timing failures during concurrent runs
  cleared with bounded test concurrency. No real workspace/provider data,
  persisted schema, commit or deployment changed.

- [x] Reclaim hidden Planner menu space (2026-09-13, local/uncommitted).
  Project/client attachment titles use the full desktop content width until
  hover, keyboard focus within the card, or an open menu reserves the action
  space. Phone menus stay visible beside wrapping titles. Menu keyboard events
  no longer also activate the surrounding card. Browser geometry and keyboard
  regressions failed before the fixes; all 71 related Planner tests pass.
  Chromium checks pass for both entity types at 1440/1024/390/320px, covering
  hover exit, focus, menu-open retention, Escape and phone interaction; lint and
  typecheck pass. No persisted-data changes, commit or deployment.

- Local core checkpoint (2026-09-13): the user approved committing the screenshot
  fixture and the Planner, Dashboard, expense, Account and timer polish below.
  Their dated `uncommitted` labels record validation before this checkpoint.
  These compatible changes join the planned core 1.6.0 launch release; this
  checkpoint changes no separately published agent artifact or package version.
  The local metrics startup fix remains in the independent infrastructure repo.
  Push, tagging, publication and deployment remain separate from this commit.

- [x] Add explicit timer start-date editing and diagnose local sync errors
  (2026-09-13, local/uncommitted). Start Date and Start Time share the first row
  above the note using the existing native date input. Yesterday/23:30 edits
  survive reload; future/invalid dates, DST gaps and overlaps remain guarded,
  while note-only edits preserve the original instant. Paused start corrections
  preserve their pause endpoint through shared UI/agent duration updates. Eight
  UI regressions and the paused-domain regression failed before their fixes.
  All 66 related timer/Dropbox tests plus seven focused agent command tests pass;
  useTimers coverage is 96.47% statements, 80% branches, 100% functions and 97.41%
  lines. Desktop/mobile Chromium edit/reload tests and visual previews pass;
  lint/typecheck pass. No migration, commit or deployment.
  Runtime investigation: DebugBundle had no active local incidents. The running
  local Worker's metrics DB had no tables; applying its existing idempotent
  schema restored a synthetic /metrics/batch request to HTTP 200, then only that
  synthetic row was removed. The private infra Makefile now initializes metrics
  during local preparation, and the exact Make target succeeds on repeat. Dropbox
  manifest HTTP 500s classify as provider-side temporary failures; a matching
  download regression verifies four bounded/backoff attempts without auth
  invalidation. No evidence here establishes the cause or current recovery of
  the user's specific upstream Dropbox request; no real provider data was changed.

- [x] Fix expense-title ellipsis in compact lists (2026-09-13,
  local/uncommitted). Shared ExpenseDueCard bounds its category/title flex group
  and truncates the title text itself, covering Today, Upcoming and due-expense
  groups across desktop, compact/mobile and non-clickable rows. Full-title
  tooltips and fixed-size expense/category icons remain available. Six focused
  regressions failed before the fix; all 55 related card/list/dashboard tests
  and lint pass. Chromium checks verify actual overflowing ellipsis before and
  during hover, payment-action visibility and row containment in Today/Upcoming,
  plus existing main expense-list ellipsis, at 1440/1024/390/320px. No payment,
  date, persisted-data or selection behavior changed; no commit or deployment.

- [x] Stabilize Account authentication action (2026-09-13,
  local/uncommitted). The header follows the existing lifecycle-bound retained
  session instead of cloud transport connectivity: Sign out persists during
  connecting/syncing, offline operation and temporary outages; absent or
  invalidated sessions show Sign in, and initial unresolved identity shows
  disabled Checking account progress. Reconnect remains a Cloud Sync recovery
  concern. Account now observes actual browser online/offline events instead of
  reading a nonexistent Yjs context property. Sign-out confirmation is blocked
  while sync is unavailable/busy, and live connected/idle/no-pending-upload
  checks prevent local deletion after handled auth failures. No auth storage,
  provider requests, entitlement decisions or sync scheduling were changed.
  Red/green Account regressions and all 158 related Account/auth/lifecycle/sync
  tests pass; four disposable Chromium checks cover Google/Dropbox at 1440px and
  390px, including retained-session outages and invalidation. Full lint and
  typecheck pass. Unit tests use the expected public marketing origin instead
  of the dev container's local site override. No live provider mutation, full
  app coverage/build, commit or deployment.

- [x] Remove resolved-item urgency from Today (2026-09-13,
  local/uncommitted). Completed task rows and paid expense rows retain their
  crossed-out confirmation state without date/recurrence/Overdue badges; paid
  expenses also lose any stale overdue details button/opacity. Reopening the
  task or receiving canonical unpaid updates restores the applicable overdue
  badge. Future fixed automatic expense occurrences retain their upcoming
  schedule under the existing paid-display exception. Dates, recurrence,
  selection, payment history and shared task badges elsewhere are unchanged.
  Eight desktop/mobile, ordinary/recurring transition regressions failed before
  the fix. All 140 Dashboard/due-expense/date-badge/auto-payment tests, full lint
  and typecheck pass. The Chromium transition smoke passes at 1440px and 390px,
  including completion/payment, persistence after reload, reopening and retained
  source dates. No full-app coverage/build, commit, publication or deployment.

- [x] Show consistent Upcoming item totals (2026-09-12, local/uncommitted).
  The heading counts all upcoming task and expense rows, including zero, while
  the collapsed list keeps its five-item preview. The button reports the hidden
  count as “Show N more” and becomes “Show less” when expanded; the heading total
  stays fixed. This supersedes the earlier task-only heading interpretation.
  The seven-day selector and item actions are unchanged. Corrected mixed-item
  and expense-only expectations failed before the change; all 100 Dashboard
  unit tests, full lint, and the Chromium responsive Dashboard smoke pass
  (320/390/768/1024/1440px, dark/light). A disposable browser also verifies the
  screenshot fixture: Upcoming (8), five visible rows, Show 3 more revealing
  all eight, and Show less restoring five. No commit or deployment occurred.

- [x] Remove project deadline-status badges from Planner cards (2026-09-12,
  local/uncommitted). Desktop and mobile attached project cards no longer show
  due-date, overdue, or resolved-deadline pills that wrap in narrow columns.
  Quote-stage badges and separate flag-marked deadline items remain; project
  deadlines, scheduling and persisted data are unchanged. Removed unused display
  props/helpers and reconciled planning/acceptance docs. Red/green expectations
  confirmed four failures before the change; all 79 related planner tests now
  pass, alongside full lint/typecheck. Disposable Chromium checks with the
  screenshot fixture pass at 1440px and 390px with no page errors. No commit,
  deployment, full-app coverage or production-build gate was performed.

- [x] Simplify the onboarding welcome step (2026-09-11, local/uncommitted).
  Removed the public-site “Learn more about TaskTime Pro” action and its unused
  origin/button styling dependencies. The step content now owns a responsive
  16px/24px top inset, so the hidden-header modal has deliberate breathing room
  above its icon while the shared modal's header/scroll spacing contract stays
  unchanged. Shared onboarding legal links and the Account footer now use the
  concise Privacy and Terms labels without changing their destinations.
  Red/green coverage checks both the absent link and measured icon spacing:
  5 focused component tests and 2 Chromium onboarding smokes pass, alongside
  core lint, typecheck, 6 build-contract tests and 5 production-PWA checks. No
  onboarding persistence, workspace data, sync, billing or production state
  changed.

- [x] Remediate core dependency advisories (2026-09-11, local/uncommitted).
  Fresh full audit falls from 57 entries (3 critical, 17 high, 36 moderate,
  1 low) to **zero**, including development dependencies. Patched locked
  versions: Tiptap family 3.31.3, jsPDF 4.2.1, DOMPurify 3.4.15,
  Vitest/coverage 4.1.11, Vite 7.3.6, PostCSS 8.5.28, uuid 13.0.2 and
  compatible transitive fixes (including Workbox 7.4.1, Rollup 4.63.1 and
  brace-expansion 1.1.18). Coverage is now correctly a development dependency.
  Direct major versions are unchanged; no forced fix, peer bypass, override,
  advisory suppression or coverage-floor reduction was used. Stale Tiptap lock
  entries required coordinated regeneration; clean `npm ci` and `npm ls --all`
  pass without peer conflicts.
  The real installed editor first failed the upstream prototype-key regression
  on the old version, then passed after updating. Historical version-1 notes
  open without a rewrite, retain task/link formatting, and support edit/undo/redo.
  The full core release gate passes: audit, lint/typecheck, 6 artifact tests,
  **280 files / 2,709 unit tests**, 93.16% statements / 84.61% branches /
  94.35% functions / 94.49% lines, **62 Chromium smokes and 5 production-PWA
  checks**. An additional real-PDF blob/sanitization browser regression and
  fresh lint pass (63 browser scenarios total); invoice/quote downloads remain
  covered. Agent builds, managed bundles and isolated live MCP workflow pass;
  the pinned site contract still matches public semantics.
  A fresh standalone Docker image also audits clean and builds `dist-app`
  without host source mounts, the retired blog, or either nested repository.
  Only the local app was stopped for `npm ci` and restarted: its same container
  and dependency volume now use the patched packages, app/site return HTTP 200,
  and site/Worker/scheduler/Stripe listener containers were not replaced.
  No user-data/schema/sync/entitlement contract or production state changed.
  Evidence: `/private/tmp/tasktime-core-security-copy.fyomiq/` (temporary).
  Exact release-candidate audits and promotion approvals remain in Phase 4.
- [x] Verify app ownership during the final site-migration sweep (2026-09-11,
  uncommitted): manifest/start identity/icons and same-origin worker scope remain
  intact; five production-PWA checks cover installation metadata, offline boot
  and public-route escape. Robots now permits crawling so the existing noindex
  metadata is observable. No app data/sync/runtime dependency changes.
  Lint/typecheck, 6 artifact/security-entry tests, 279 files / 2,707 unit tests
  (93.2% statements) and 62 Chromium smokes pass. Site independently passes its
  full gate. Details: `tasktime-site/STATUS.md`.
- [x] Group local development under `tasktime` for Docker Desktop Stop/Play
  (2026-09-11, uncommitted). The detached group includes app 3101, optional site
  3102, and the existing Worker/scheduler/Stripe test listener. The site's own
  Compose definition is included only when available; app/site links use the
  local pair, with a coordinated `TASKTIME_SITE_PORT` host override. Core tooling
  uses `tasktime-tools`, without optional checkouts or shared runtime dependencies.
  The old `tasktime-dev` containers/network were replaced without deleting
  volumes; Worker bind-mounted state and browser origin remain unchanged. A
  stopped-state backup is retained in `/private/tmp/tasktime-compose-group.mZLMlc/`.
  Stop/start preserved all five containers and restored app/site/Worker HTTP 200;
  this was verified through Compose, not Docker Desktop UI automation (unavailable).
  Red/green covers the old lifecycle and all four optional-checkout combinations.
  Full core release gate passes: lint/typecheck, 5 artifact/export tests, 279 files
  / 2,707 unit tests with coverage (93.2% statements), 62 browser and 4 PWA tests.
  Independent site gate passes, including concurrent validation with container-local
  Astro generated state. No app-domain behavior, persisted schema, dependency
  version, production configuration, commit, push or deployment changed.

- [x] Separate the core build from the public-site repository (2026-09-11,
  uncommitted). Core install/build/test needs neither nested checkout. Astro and
  public assets/content moved to ignored `tasktime-site/`; core retains the
  discovery source and exports an explicitly versioned/checksummed public JSON
  snapshot. Core emits only `dist-app`, with non-indexable metadata/robots,
  generated site-origin redirects and the unchanged app SPA/PWA ownership.
  Legal/account/onboarding links use the exact marketing origin. No persisted
  shape, sync behavior, domain mutation, hosted API or agent runtime changed.
  Pre-ship review caught the partial service-worker public-route exclusion;
  the shared route list now also protects pricing, agents, sitemap and discovery
  from poisoning the offline app shell.
  Final Docker `npm run release`: lint/typecheck, 5 artifact/export tests,
  279 Vitest files / 2,703 tests, 93.2% statements / 84.61% branches / 94.35%
  functions / 94.49% lines with configured coverage floors, 62 browser smoke
  tests and 4 production-PWA tests all passed. A clean app image builds without
  site, infra, the retired blog or host source mounts. Standalone site passes
  its own gate; public generated catalog/discovery/skill bytes match baseline.
  Private assembler has 2 passing negative/compatibility tests and new workflows
  parse locally, but no remote workflow was dispatched. Phase 4 owns remaining
  security/content reviews, source promotion, deployment and user migration.
  This extraction adds no agent publication train beyond the already-planned
  broader checkpoint. No commit/push/tag/remote creation/deploy occurred.

- [x] Task/account/category UI polish (2026-09-09, uncommitted): recurring tasks
  offer Disable recurrence / Enable recurrence only in their three-dot menus,
  with calendar-off/calendar-check icons
  instead of timer pause/play icons. Shared browser/agent state rules retain history and
  establish a local resume boundary without catch-up; scheduling and notification
  consumers honor it, and planner completion history remains visible.
  Expense category add/edit uses a wider separate modal, the existing Color Tag
  picker, and a right-aligned action opposite Active categories. Category color
  is now the only expense accent source: cards use it on the left border without
  a repeated dot, while dashboard/due/activity rows use original-color 8px dots
  with neutral fallbacks. This is covered across the main and recurring expense
  views, dashboard, Planner, client/project sections, reports, and invoice selection.
  Compact category labels now constrain and ellipsize long names before adjacent
  visuals, while keeping the complete name available through the title tooltip.
  The desktop expense status tabs retain horizontal overflow while explicitly
  clipping the unnecessary vertical scrollbar.
  Dashboard project rows use compact colored folder outlines and align their
  metadata with the row edge to distinguish them from expense category dots.
  Planner project attachments now use the folder glyph as well. The Projects
  page places one neutral project icon at the main heading, keeps card titles clean, and
  matches the Clients page's 24px active/archived grid gap. Project detail
  replaces its color dot with the shared folder treatment using project color,
  inherited client color, or a neutral fallback. Project cards also match Client
  card padding, place status tags immediately after the title with the aligned
  menu at the far right, and omit the
  redundant Most recent display while retaining recent-activity sorting. Their
  details and invoice/deadline pills now share a flexible two-column row on both
  the Projects page and Client Dashboard, wrapping only when space runs out.
  Client identity now uses the shared neutral users icon in the Clients heading and a
  client-color/neutral single-user version beside the Client Dashboard title. Project-card
  client names provide isolated pointer and keyboard navigation to that client.
  Planner projects now retain a 4px neutral left identity border when neither
  the project nor its client supplies a color.
  Planner expense items now use a dotted left accent only, retaining their
  category color or neutral fallback while the other card edges remain solid.
  Project and Client list entity totals hide below the `sm` breakpoint to keep
  the existing phone header actions on the same compact row.
  Unbilled metrics were subsequently restored to the reference layout: the
  heading sits above compact left-aligned work and optional expense amount rows.
  Shared three-dot action menus are non-modal and no longer lock page scrolling;
  they close once their trigger moves past an 8px scroll threshold. Unit and
  cross-browser wheel-scroll regressions cover the common primitive.
  The recurrence actions use the same icon spacing as adjacent menu items.
  Disabled schedules replace list recurrence tags with a neutral calendar-off
  `Disabled` tag and show the same tag inline with the repeat description under
  Schedule in task details; task titles stay clean.
  Planner and the global timer now share the animated danger-color running dot.
  Archived category identity is retained, including live color updates in open
  expense details; expenses and recurrence templates reference category IDs, so
  category name/group/color changes render dynamically. Recurrence category edits
  offer an optional counted update for existing linked expenses that still match
  the previous category, preserving individual overrides and every other saved
  field. Referenced-category delete failures open a visible dialog with usage and
  Archive guidance. The inline Manage categories action uses the existing modal stack and
  restores the expense draft and edit context. A follow-up fix scopes that draft
  to the exact expense/recurrence, stops post-save re-persistence, and clears all
  task/project/expense stack drafts at their intentional close boundaries.
  Optional fields survive Yjs
  transfer and legacy records still validate. Sidebar expansion uses one-line ellipsis
  and displays the full title when expanded. Account offers provider sign-in with
  an icon in the header and the same primary provider buttons as Cloud Sync, with
  retained-provider recovery, duplicate/offline guards and
  focus restoration across viewport changes. Project billing/planning sections
  appear only once a client is selected, collapse with summaries, and expand/focus
  invalid fields; flat-rate overrides remain reachable. Dashboard invoice links
  show a pointer when actionable and apply danger text only to overdue invoices;
  Upcoming reuses the vertically centered Today desktop row. Specs, contracts,
  overview/map, and TODOs are reconciled.
  Follow-up review corrected stale task-editor pause/resume fields and stale
  menu actions, missing/zero rate validation in collapsed billing, retained
  Dropbox status retry and cross-consumer auth recovery, and visible errors
  after authentication succeeds but storage connection fails. Red/green
  regressions cover stale recurrence, collapsed billing, and retained-session
  recovery; browser cases also preserve a
  running timer, skip state, and completion history through an open task edit.
  Final review checks before the neutral index-icon follow-up: 277 files / 2,639
  unit tests with per-file coverage, lint, and typecheck passed. All nine affected
  task/account/category/project/sidebar scenarios passed in Chromium, Firefox, and
  WebKit after the complete 59-scenario Chromium smoke gate.
  Light/dark category dialogs, recurring-category propagation, phone sign-in,
  dashboard alignment/category color, and project/sidebar visuals were inspected
  during implementation. Six PWA tests
  and the full production build passed on that
  reviewed baseline. Typecheck, lint, and agent bridge/bundle smoke passed; the
  generated agent artifacts were rebuilt during implementation.
  The follow-up neutral Projects/Clients index headings pass 21 focused component
  tests, their focused Chromium scenario, full lint, and scoped diff checks. The
  broader cross-browser, coverage, PWA, typecheck, and build gates were not rerun
  after this two-class visual refinement.
  The Dashboard running-project lock now reaches every task-details entry point:
  other tasks in the same project use native-disabled title controls across
  Today, Upcoming, and Tasks, and overdue dates no longer remain clickable while
  the row is disabled. The timer-owning task and paused timers remain interactive.
  Red/green validation passes 31 focused component tests. The broader Dashboard
  unit gate passes all 100 tests across 16 files, and all seven Chromium Dashboard
  scenarios pass, including the lock at 1440px and 390px. The focused interaction
  also passes in Firefox and WebKit. Full lint, typecheck, and scoped diff checks
  pass; coverage, PWA, and build were not rerun for this interaction fix.
  A text-only follow-up removes the redundant `Next 7 days` subtitle from the
  Upcoming header while retaining the same scheduling window. All 18 focused
  unit tests, the Chromium multi-width Dashboard scenario, and full lint pass.
  The final review remains local; no OAuth account
  login, provider transfer, publication, version bump, commit, or deployment.
  Release scope: core Phase 3 remains the planned 1.6.0 train. Agent bridge and
  OpenClaw shipped tool metadata now also change (category color and recurrence
  pause); the vendored bridge is regenerated. Assess their release versions at
  the next requested commit/push. Unchanged Claude/ClawHub wrappers need no
  content update for these fields.

- [x] Correct no-client billability and preserve billing through task moves (2026-09-08,
  uncommitted): saved/live dashboard hours, dashboard unbilled estimates and
  project filtering, browser Hours/work-summary/export calculations, and agent
  reports/unbilled queries now share current task/project/client classification.
  A retained or auto-set task flag alone cannot make standalone/personal work
  billable. Missing relationships are non-billable; archived client work remains
  classified normally. Moves/client changes refresh projections without data
  migration, flag rewrites, interval changes, or invoice mutations. Complete
  legacy merged-task evidence is matched before filtering current billability,
  so moving one old source cannot reopen another already-invoiced source.
  Automatic marking in tasks, subtasks, and manual-entry flows now requires
  client-project context; task controls and Kanban badges follow the same rule.
  Sent/paid invoice move regressions cover another client, a personal project,
  and standalone work: entry claims/rates/increments, original invoice context,
  and task billing cutoffs survive; later work follows the destination. Unpaid
  cancellation releases its original claims without moving the task back, and
  paid cancellation remains blocked. Existing timer/hierarchy move guards remain.
  Draft finalization rejects changed source project/client/billability before
  mutation. Additive `agentDraft.projectClientIdAtPreview` retains explicit
  invoice-recipient selection independently of source-client changes; older
  drafts retain context checks. Legacy rate markers now lock manual edits, and
  invoice previews/selectors plus report uninvoiced totals resolve complete
  legacy source evidence before current-project/visible-period filters.
  Red/green regressions cover the defects. Docker `npm run release` passed:
  273 files / 2,566 tests with coverage, lint, typecheck, 50 Chromium smoke,
  six PWA smoke, and app/blog build. The last Kanban-only guard followed the
  Chromium run and was included in the final build; its 32 focused task/board
  tests passed, followed by final lint/typecheck and 273 files / 2,569 tests
  with coverage. Logs: `/private/tmp/tasktime-billability-release-gate.log`
  and `/private/tmp/tasktime-billability-final-coverage.log`.
  No commit, push, release, deployment, or production-data operation occurred.

- [x] Phase 3 continuation commit and thread handoff (2026-09-08): includes all
  current Expenses overview/interactions, dashboard color dots/empty states/axis
  sizing/live tracked-time changes, shared Yjs/Billing context identity fixes,
  tests, specifications, and existing user TODO edits. The original Expenses
  table and tabs remain intact. The homepage checkpoint is already in `faa4441`.
  Final source validation: 270 files / 2,525 unit tests with coverage, eight
  Dashboard/Timer/Reports Chromium scenarios, lint, typecheck, and production
  app build pass. Earlier full 47-scenario smoke and six PWA checks predate the
  final dashboard refinements; they were not rerun for this commit.
  Release assessment: next core-app minor release `1.6.0` from `1.5.0`;
  no published agent artifact contents or metadata changed. This checkpoint
  does not bump versions, tag, push, publish, or deploy. Continue the remaining
  Phase 3 UX work in the next thread, using TODO and these feature definitions.
  No known blocking issue remains; production launch/release gates stay separate.

- [x] Include live timers in Dashboard tracked-time displays (2026-09-08):
  Tracked today and its sparkline, selected-period Tracked time and its time
  trend/billable detail, and Hours tracked include active elapsed time. A
  dashboard-only clock samples each minute while visible and refreshes on timer
  lifecycle changes or focus/visibility return. Paused time stays fixed.
  Period attribution follows the existing local effective-start-date rule.
  No synthetic entries, billing rounding, sync writes, or financial projection
  changes; all other widgets and standalone Reports retain existing behavior.
  Stopped-entry identities suppress duplicate live contributions, including
  legacy timers. Small active-time labels distinguish unsaved contributions.
  Red/green regressions cover sampling, pause/resume/edit/discard, concurrent
  timers, midnight, historical selections, hidden/focus recovery, financial
  object stability, and saved-entry/timer coexistence. Isolated browser proof
  covers real timer controls, minute growth, zero periodic Yjs writes, unchanged
  unbilled amounts, stop and reload. Full Docker gate: 270 files / 2,525 tests
  pass with coverage; the new hook has 100% line/function and 95.23% branch
  coverage. All eight Dashboard/Timer/Reports Chromium scenarios pass, plus
  lint, typecheck, production app compilation and diff checks. Specs,
  overview/map and TODO are reconciled. Included in the Phase 3 continuation checkpoint; undeployed.

- [x] Tighten overview chart presentation (2026-09-08): Expenses and Dashboard
  Hours tracked use Recharts automatic Y-axis width based on formatted labels, replacing the fixed gutter
  and negative left margin. Reports Overview no longer adds an empty-period
  message below Hours tracked. Existing text assertion and design notes updated.
  Installed Recharts support was confirmed; visual review remains with the user
  and no automated checks were run. Included in the Phase 3 continuation checkpoint; undeployed.

- [x] Align widget empty states (2026-09-08): To Do Today now uses the shared
  32px icon size. Expenses By category and Recent activity use centered shared
  empty states with 32px muted icons and existing labels, without descriptions.
  Visual review is left to the user as requested; no automated checks were run
  for this styling-only adjustment. Included in the Phase 3 continuation checkpoint; undeployed.

- [x] Refine project identity in the Dashboard Projects widget (2026-09-09):
  14px folder outlines beside project names preserve the original project color,
  inherit the associated client color when absent, and otherwise fall back to
  neutral. The client/pending-time line now aligns with the folder's left edge,
  matching expense metadata alignment while distinguishing projects from expense
  category dots. Icons remain decorative within the project-name button, with no
  extra keyboard stop. Client links, pending values, filters and row padding are
  preserved; long names truncate. No data fields or other project lists changed.
  Red/green component coverage passes. The focused project navigation/layout
  scenario passes in Chromium, Firefox and WebKit at 1440/390/320px in light and
  dark mode, including exact/inherited colors, 14px sizing and metadata alignment.
  Included in the Phase 3 continuation checkpoint; undeployed.

- [x] Extend project identity across Planner, Projects, and project detail
  (2026-09-10): Planner project attachments use the closed-folder glyph while
  deadline markers retain their flag. The Projects page uses one section-level
  neutral project icon, text-only card titles, and the same 24px active/archived grid
  spacing as Clients. Project detail replaces the title dot with the shared
  project-color folder, preserving project-first, inherited-client, and neutral
  fallback behavior. Cards match Client padding, group their status badge and
  title together while keeping the aligned menu at the far right, and omit the recent-activity label/date while
  retaining the existing sort input. Project-list and client-dashboard cards
  share one responsive details row with text on the left and invoice/deadline
  pills on the right, removing the separate empty footer space while preserving
  narrow-card wrapping. This changes no persisted records. All 59 focused
  component checks, lint, typecheck, and the full 50-page production
  build pass. The initial project-icon/spacing Chromium scenario passed before
  the user reserved further visual review; the final card and column refinements were not
  browser-reviewed. The work remains uncommitted and undeployed.

- [x] Extend matching identity and navigation to clients (2026-09-10): the
  Clients page places the shared users glyph in neutral muted-foreground beside
  its heading, while Client
  Dashboard replaces the former color dot with the Planner's single-user icon using the exact saved
  client color or the neutral fallback. Associated client names in project cards
  are native navigation controls with pointer, underline, focus, and isolated
  click behavior so they open the client without opening the project. No stored
  relationship or color data changes. All 68 related component checks, lint,
  typecheck, and the full 50-page production build pass. The client-name hover
  treatment matches the existing Project Dashboard link without a custom
  underline offset. Final browser review remains with the user. The work remains
  uncommitted and undeployed.

- [x] Trace the Dashboard scrolling console error (2026-09-08): opened the
  user's exact `VM2292:2:19429` source in Edge DevTools. The failing
  `et.reportAllChanges` callback is DevTools' injected INP/Web Vitals reporter
  reading `metric.entries[0].startTime` without an entry. It includes
  `window.devToolsReportSoftNavs` and matches Chromium's live-metrics script;
  the current upstream event builders use optional entry access in
  [spec.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/live-metrics/web-vitals-injected/spec/spec.ts).
  No matching reporter exists in app source, the diagnostics SDK, or Recharts,
  and the local DebugBundle incident list is empty. A disposable Chromium
  diagnostic passed 15 scroll gestures at 1280/390px, chart keyboard interaction,
  and three Planner/Dashboard round trips with no runtime or ErrorBoundary
  errors. No app-code patch or error suppression was applied. Closing DevTools
  and reloading avoids its injected reporter; browser-release inclusion of the
  upstream guard was not verified.

- [x] Verify the Reports navigation provider fix locally (2026-09-08). Reproduced the
  reported `useYjs` error by opening Expenses, emitting a shared Modal hot update,
  then opening Reports for the first time with enforcement enabled. Vite loaded
  a new consumer-side context while the original provider remained mounted.
  The same module-identity issue silently dropped Reports' billing context.
  UI-independent context modules preserve both identities without changing
  provider lifecycle, persisted records, routing, or entitlement decisions.
  The exact browser reproduction and the red/green billing-context unit
  regression pass. Earlier cold/default-enforcement smoke checks missed this
  path; the standard browser gate now includes it and catches handled React
  ErrorBoundary errors. Docker-backed validation passes: 268 files / 2,513 unit
  tests with the configured per-file coverage gate, all 47 Chromium smoke
  scenarios, lint, typecheck, the 50-page production build, and six PWA checks.
  The existing localhost workspace also passes fresh Expenses -> Modal HMR ->
  first Reports navigation with advanced report access, retained totals, and
  In sync status. The stopped dev app required a scoped container restart after
  a separate file-watcher ENOMEM; no browser data reset was needed. Docs and
  architecture guidance are reconciled. Included in the Phase 3 continuation checkpoint; undeployed.

- [x] Refine Expenses overview interactions locally (2026-09-08): Show more
  opens the shared Modal with the last 30 local calendar days of recorded
  activity; the widget stays at three rows and retains its next-payment hint.
  Both activity views use padded rows, pointer cursors, and the shared blue
  service-name hover/focus treatment. Detail-modal navigation and close-focus
  restoration are verified; Modal exposes an optional close-autofocus passthrough
  without changing existing callers. Recurring expenses and Upcoming payments
  use full-area native buttons and no bottom links, preserving their destinations.
  Red/green regressions and 35 focused tests pass, with the changed overview files
  above the 75% per-file coverage gate. Four expense Chromium scenarios pass,
  including keyboard activation, card-edge clicks, original payment/reload flows,
  30-day boundaries, nested detail navigation, and modal scrolling at 1440/390/320px.
  Lint, typecheck, the production build, and diff checks pass. Specs are reconciled;
  the original expense list/tabs remain unchanged. Included in the Phase 3 continuation checkpoint; undeployed.

- [x] Complete the Program Phase 3 Expenses overview locally (2026-09-08):
  neutral cards for period paid spend, estimated monthly recurring commitments,
  existing upcoming occurrences, and top category; six-month spending bars,
  category breakdown, and recorded activity. Phones use a summary rail and
  place the original actionable list before stacked analytical panels.
  The attempted list/table redesign was removed at the user's request:
  `ExpenseList`, `ExpenseRow`, the status-tab markup, and list props match the
  preceding commit. Existing sorting, status/date buckets, recurrence previews,
  filters, and payment/edit flows are preserved. Tests now distinguish original
  row headings from the same expense appearing in Recent activity.
  Paid FX snapshots remain authoritative; mixed unavailable currencies never
  become a combined chart/trend. Archived category names remain available in
  summaries. History failures expose retry while preserving existing billing/
  reports completeness gates; nested archived edits refresh overview values.
  Red/green regressions cover projections, history failure/retry, archive
  observation, completeness, and category retention. Docker-backed validation:
  268 files / 2,510 tests and the 75% per-file coverage gate passed; the final
  category wiring also passed the 14-test expense/list integration check.
  All 44 Chromium smoke scenarios and six production PWA checks passed,
  including first Expenses/chart navigation offline. Responsive captures were
  inspected at desktop and 320/390px, with overflow checks through 1440px.
  Final lint, typecheck, the 50-page production build, and diff checks passed.
  Specifications, hook interface docs, architecture summaries, and tracking
  are reconciled. No dependencies or persisted schemas changed. Included in the Phase 3 continuation checkpoint; undeployed. Subsequent
  Phase 3 work remains open.

- [x] Reconcile and validate the complete Phase 3 local checkpoint (2026-09-08):
  dashboard layout/reports and follow-up fixes, homepage presentation/copy,
  product naming, and shared project icons. Specs, acceptance criteria,
  architecture summaries, development guidance, and work tracking match the
  final implementation. Docker-backed lint, typecheck, all 266 files / 2,497
  tests with the 75% per-file coverage gate, all 42 Chromium smoke scenarios,
  the 50-page production build, and all five production PWA checks pass.
  Coverage used `docker compose run --rm app npx vitest run --pool=threads
  --maxWorkers=2 --testTimeout=30000 --coverage`; the PWA checks consumed that
  completed production build. An initial run inside the interactive billing
  sandbox inherited enforcement flags and failed default account-policy
  fixtures; the isolated gate passed without source or assertion changes.
  README now explains the validation environment and dependency-volume boundary.
  Release assessment: next core-app minor release (`1.6.0` from `1.5.0`), with
  no changed published agent artifacts. This is a local commit checkpoint only;
  versions, tags, remote publication, and deployment are not part of it.
  Final homepage captures and the remaining Phase 3/launch work stay pending.

- [x] Complete the Reports Overview refinement locally: bordered chart aligned with the
  four cards, right-aligned legend, neutral preceding-period trends, 8h minimum
  axis ceiling rounded up for larger daily totals, and removal of the upcoming
  estimate note and visible daily-values dropdown. Implementation, 74 focused
  tests with all changed files above 75% coverage, desktop/phone Chromium checks,
  lint, typecheck, and the production build pass. All five production PWA checks
  pass, including first dashboard/chart navigation offline and the keyboard
  tooltip. The stale dropdown interaction in that smoke was replaced with the
  screen-reader table and tooltip assertions. No persisted data or mutation
  contract changed; the refinement is part of the local Phase 3 checkpoint and
  remains undeployed.
  Follow-up crash correction: the Dashboard currency-warning effect still read
  removed `report.upcomingExpenses` after exchange rates loaded successfully.
  The earlier snapshot fixture used null rates and skipped that branch. Updating
  it to successful rates reproduced the exact exception; removing the obsolete
  reference fixes it while preserving conversion warnings. All 75 dashboard
  tests and three Chromium scenarios now pass, including actual asynchronous
  rate loading and a reload with cached rates in an isolated browser context.
  Final presentation refinement removes the chart's duplicate total/trend and
  aligns its legend with the title. Labels use “vs last month”, “vs last 90d”,
  “New”, and “N/A”; trend rows stay on one line with full hover text. All 75
  dashboard tests, three responsive/currency Chromium scenarios, changed-file
  lint, and the repository typecheck pass.

- [x] Complete the Program Phase 3 dashboard readability slice locally
  (2026-09-08). Today and Upcoming share existing task/recurrence/timer/expense
  handlers; Upcoming exposes all items after the first five. Fixed summary cards
  show saved time today, tasks due today, this month's hourly unbilled estimate,
  and all unpaid invoices. A preset selector controls four report metrics and
  the stacked actual billable/non-billable chart. Phone DOM order puts actions
  first, with a horizontal summary rail. Definitions are authoritative in
  `spec/designs/work-and-time.md#dashboard-overview`.
  History observes validated active/archive maps, loads required entry years and
  legacy billing intervals, ignores stale requests, and exposes loading/retry.
  Paid snapshots and canonical eligibility remain authoritative; failed FX
  preserves original currencies without a retry loop. Recharts 3.10.1 and its
  matching React peer are pinned; the chart engine is a separate ~105 KB gzip
  chunk. Total compressed app JavaScript increased by ~109 KB against the local
  pre-change build. The PWA cache tolerates Origin-header variation only for
  manifest-listed public build assets, enabling first dashboard navigation offline.
  Docker validation: 266 files / 2,483 tests and all 75% per-file coverage
  thresholds pass, including the dashboard modules now in the regular coverage
  gate. The busy host required the isolated command
  `npx vitest run --pool=threads --maxWorkers=2 --testTimeout=30000 --coverage`;
  no assertions or persisted timeout defaults were relaxed. All 41 Chromium
  smoke scenarios were verified through the full suite and focused reruns of
  the updated dashboard fixture/payment-snapshot selectors. Keyboard tooltip,
  exact daily values, historical periods, and 320/390/768/1024/1440px layouts
  pass; light/dark screenshots were inspected. Lint, typecheck, the real 50-page
  production build, all five PWA smokes, and diff checks pass. Existing homepage
  edits, recent-widget limits, other actions, routes, `/reports` entitlements,
  Yjs contracts and provider behavior are preserved. These are the initial
  slice's validation results; final checkpoint evidence is recorded above.
  Follow-up runtime verification (2026-09-08): the running full-stack app used
  `tasktime-dev_node_modules`, separate from the validated `tasktime_node_modules`
  volume, and still lacked Recharts. Installed the existing lockfile with
  `docker exec tasktime npm ci` and triggered Vite's config restart without
  stopping the Worker/Stripe stack. The actual server on port 3101 now resolves
  the chart module; a fresh Chromium context renders the dashboard chart with
  zero Vite overlays or page exceptions. The dependency-refresh workflow is
  documented in README; no application source correction was required.
  Follow-up visual refinement: Today/Upcoming now stretch to equal desktop
  heights. Upcoming's centered empty state uses a 32px icon and title only;
  stacked phone panels retain natural heights. All 28 existing focused dashboard
  tests and changed-component lint pass. Fresh Chromium checks against the
  running app verify equal 1440px panel heights, compact 390/320px stacking,
  the smaller icon, no description, no page overflow, and no page exceptions.

- [x] Align Projects with the closed-folder icon through shared `ProjectIcon`,
  including desktop/mobile navigation, onboarding, dashboard summaries, project
  and client empty states, and report filters. The New Task clipboard remains
  unchanged. This visual-only change passes 63 existing focused component tests,
  lint, typecheck, and the production build/PWA gate locally.
- [x] Complete the simplified Program Phase 2 local gate. The focused origin,
  provider-bootstrap, backup/restore, metrics, and agent tests pass alongside
  lint, app and Worker typechecks, the full Worker suite, the real split 50-page
  production build, and agent bridge/bundle smokes. The private runbook now
  contains the supervised per-user reconnect/import, hosted-service verification,
  PWA/Push transition, exact two-Pages-project/one-Worker topology, immutable
  root rollback artifact, deployment-authority checks, ordered stop/go stages,
  reusable private execution-record template, and final Cloudflare/OAuth/DNS
  cleanup inventory. No live change occurred.
- [x] Complete Program Phase 2 Slice 2 locally: emit deterministic `dist-app`
  and `dist-site` release inputs while retaining the existing combined `dist`
  surface and application root. App-only PWA/SPA ownership and site-only Astro/
  discovery/robots ownership are enforced; unequal collisions, missing outputs,
  wrong product canonical links, and missing referenced assets fail the build.
  Five focused red/green tests, the real 50-page build, lint, and typecheck pass.
  No split artifact has been deployed and no live route or domain changed.
- [x] Complete Program Phase 2 origin preparation locally: centralize exact validated
  marketing, application, Worker, and agent-documentation
  origins; add `app.tasktime.pro` compatibility to browser metrics, agent bridge,
  and both Google Drive and Dropbox Worker OAuth paths; and reject malformed,
  credential-bearing, wildcard/suffix, path-bearing, and non-HTTPS non-loopback
  authority while preserving the exact production-preview loopback origin.
  Focused app tests, lint, app/Worker typechecks, the combined build,
  and the complete Worker suite passed at this checkpoint. No live configuration, OAuth-console, domain,
  deployment, or agent-publication change occurred.
- [x] Simplify Program Phase 2 to the supervised two-user path: use the same
  provider's existing pristine-device bootstrap first and the complete validated,
  crash-safe portable backup/import only as fallback. Do not build or retain a
  cross-window migrator, and never copy origin-scoped OAuth, license, Push,
  metrics, or agent-pairing state. Keep the old workspace available until the
  new origin is verified.
- [x] Keep production telemetry provider-neutral by passing the lifecycle-selected Google Drive or Dropbox hosted-service session into the existing privacy-safe active-person dedupe path; reconcile the internal analysis wording without adding provider identity to metric rows. Also confirm successful portable-backup restores with a toast and replace the Dashboard Time Entries widget's hidden 30-day cutoff with a newest-first 10-entry limit while retaining its visible project filter and the separate expense window; when no active entries remain, load the newest available archived year so stale-but-latest work is still shown.
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
  it; the stable TaskTime reference now follows that email as an opaque support/
  operator handle rather than an authentication or Stripe identity.
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
  presentation during that reconnect. The explicit **Refresh status** action now
  requests canonical `user_retry` reconciliation and forces the following signed
  status read so the ordinary foreground cooldown cannot hide a provider change.
- [x] Align entitlement presentation and universally Free client capacity across
  product surfaces (2026-09-10, uncommitted). `BillingContext` now publishes one
  verified plan plus connection-readiness state, while a shared Get Pro policy
  drives both Plan & Billing and the new rocket-led Reports Overview action.
  Cached Pro remains Pro while reconnecting; Reports stays locally available and
  hosted Send distinguishes offline, automatic reconnect, and explicit Cloud
  Sync recovery instead of showing an upgrade prompt.
  Locked advanced Reports previews now use that same state rather than one
  generic account-confirmation fallback: a fresh account-free browser offers
  **Get Pro to unlock** the selected report, explicit reconnect opens Cloud
  Sync, automatic reconnect shows progress, and offline asks the user to go
  online.
  Fresh unresolved browsers can create their first client in both browser and
  agent paths, while a second active client still requires verified Pro status.
  The focused Reports entry-point/preview/policy slice passes 18 tests; the
  complete coverage gate passes 278 files / 2,668 tests with all thresholds,
  plus lint, typecheck, and the 50-page production build. Fresh isolated local
  browser checks confirm the Reports title-row action, the unblocked first-client
  form, and the Monthly preview's new Get Pro state. Production controls remain
  unchanged; no account, provider, billing, deployment, commit, or publication
  action occurred.
- [x] Harden billing-state lifecycle before launch preparation (2026-09-10,
  uncommitted). The pre-ship/security review found and fixed open-tab license
  expiry, response/sleep latency extending signed time, non-finite verification
  clocks, and offline public keys expiring at their one-hour HTTP freshness
  boundary instead of the signed-license window. Expiry/rollback deselects only
  the matching cache binding and leaves product data/license history intact.
  Failed/disconnected canonical status clears stale online actions and usage
  while retaining valid exact-bound Pro. Account-switch guards cover render-time
  plan selection, deferred Checkout/Portal/trial responses, and conditional cache
  writes/cleanup. Moved-source and partial/mismatched hosted identities retain
  reconnect guidance instead of being mistaken for fresh account-free browsers.
  Client-limit, hosted-email, and locked-report notices now share recovery
  classification. Queued client creates/restores re-read the current plan after
  acquiring the lock in both browser and agent paths, including the app-session
  scope adapter. No persisted schema, public wire shape, pricing, trial policy,
  production switch, Worker implementation, or live provider state changed.
  Final app coverage passes 278 files / 2,694 tests with all per-file thresholds;
  lint and app/Worker typechecks pass. Cross-browser Reports/client/account
  checks pass nine scenarios across Chromium, Firefox, and WebKit. The final
  50-page production build and all six PWA checks pass. The unchanged private
  Worker suite passes 37 files / 355 tests with `--maxWorkers=1
  --testTimeout=15000`; the default five-second local D1 test budget timed out
  during preceding runs, so the passing result uses an explicit larger budget
  without changing source or assertions. This is local implementation evidence,
  not production launch approval: exact live configuration/signing/Stripe and
  webhook/return-route validation plus the supervised license/recovery/hosted-
  email canary remain separate release gates. No commit, publish, deployment,
  live billing mutation, or user-data reset occurred.
- [x] Add the locally verified permanent complimentary-Pro path. Plan & Billing
  shows the opaque account reference after the provider email and renders a
  grant-backed plan as **Complimentary Pro** with no paid pricing, tax, purchase,
  or Portal controls. The private owner operation supports preview, issue,
  retained-history review, and revoke with an audit trail and atomic billing-
  profile-deletion revocation. Regression coverage proves trial eligibility,
  founding capacity, and Stripe state are untouched. Production migration,
  Worker/app release, and real grants remain explicit release operations.
- [x] Add an isolated local complimentary-Pro rehearsal that reuses the
  transactional production domain operations and supports the full preview/
  issue/UI refresh/history/revoke loop without access to production state.
  Persistence and simultaneous local-runtime access are regression-covered;
  this local evidence does not authorize release.
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
- [x] Prepare core app `1.5.2`: normalize browser-serialized invoice hours, rates, flat rates, and quantities before pricing/persistence/finalization; preserve explicit zero rates; keep merged parent/child selection and inherited pricing consistent; and reconcile compatible legacy task/project-breakdown copies while rejecting conflicting or unsupported nested copies before source billing state changes. No agent artifact, backup schema, Worker, or public-site content release is required.
- [x] Validate `1.5.2` with 2,282 Docker-backed tests across 243 files at 93.12% statement coverage, zero-diagnostic typecheck, lint, production app/public-site build, all 39 browser smoke tests, and both PWA smoke tests.
- [x] Prepare core app `1.5.1`: harden invoice time finalization UX by ignoring source seconds in invoice-facing hours and notices while retaining exact billing snapshots, accepting untouched canonical rounding without false reductions or adjustments, aggregating real reductions by task name, and suppressing internal identifiers including legacy title fallbacks. No agent artifact, backup schema, or Worker release is required.
- [x] Validate the invoice hardening with 2,241 Docker-backed tests across 240 files at 93.12% statement coverage, zero-diagnostic typecheck, lint, production app/public-site build, and all 39 browser smoke tests.
- [x] Prepare core app `1.4.1`: correct invoice custom/preset billing ranges so the full local end date is eligible in browser and agent composition, preserve historical snapshot-less invoice matching, and normalize exported custom-report timestamps to inclusive day boundaries. No agent artifact, backup schema, or Worker release is required.
- [x] Make direct Drive sync more responsive without weakening mode boundaries: Backup and Sync modes debounce note edits for 1.5 seconds, pending local work retries with bounded backoff after active-sync/Web Lock contention, Sync mode checks every five minutes only while visible, and Manual mode remains explicit-only.
- [x] Retire the Drive data proxy and temporary staging environment. The active
  edge service now provides direct Drive control-plane sessions only, denies old
  `/drive/*` browser preflight without CORS permission, and permits the exact
  local production-preview origin. The isolated staging resources, local secret
  material, configuration, tests, and runbook are removed. Current privacy,
  terms, contracts, specifications, architecture, contributor guidance, and
  public copy state the direct browser-to-Google Drive boundary.
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
