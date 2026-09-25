## September 25 cloud session recovery — archive fix validated locally; retained-profile acceptance pending

Follow-up local acceptance on September 25 reported concurrent Dropbox archive
uploads returning 409, an unhandled lazy-load rejection and Dashboard history
failure after Account refresh/navigation in a retained Edge tab. Another reload
recovered. The prior gates missed concurrent lazy writers: they waited behind a
full sync but could race each other or a later full sync. This scheduling path
predated the auth-recovery changes and is shared by Drive and Dropbox. The log
and regression support this cause; the exact retained browser session has not
been replayed. No live data reset or cloud mutation was performed.

Connection, full-sync and lazy writers now serialize in both directions. A
separate serial callback queue shares the owning Web Lock and drains before the
outer pass resumes; failed loads cannot poison later work or falsely report
success. Local edits subscribe before lazy I/O/waits. The task hook consumes
archive-load rejection and exposes additive error state. Schemas, cloud names,
conflict protections and mode-specific pull/push rules are unchanged.

Four concurrent-writer regressions failed before the correction (two providers
by ordinary/callback loading), and the task-hook regression exposed the
unhandled rejection. The corrected tests pass, including subsequent edits and
queue recovery after failure. Isolated real-app Account-to-Dashboard browser
journeys now pass for both providers with retained local history, provider
transport fixtures, no overlapping uploads/conflicts and no page errors.
Renewed Docker validation passes: 293 unit suites / 3,071 tests (one existing
skip), all configured per-file coverage thresholds, lint, typecheck, the
production build, 119 Chromium smoke journeys and five PWA checks. The unit
coverage run used two workers and a 30-second test timeout. Both provider
recovery journeys, Manual merge/reconnect, Backup timers, multi-device/tab
convergence and expired-session handling remain green. Logs:
`/private/tmp/tasktime-archive-coverage.log`,
`/private/tmp/tasktime-archive-smoke.log`,
`/private/tmp/tasktime-archive-pwa.log`, and matching lint/typecheck logs.
Owner acceptance on the reported retained Edge profile remains pending before
publication; automated provider fixtures do not verify that live profile.

Production DebugBundle incidents showed repeated failed requests to the retired
Worker `/drive/files` route after a retained Chrome session woke. The app could
select that route when `/auth/status` was temporarily unavailable. Google now
retains its session with transport unresolved until explicit direct policy is
confirmed. Google Drive and Dropbox share bounded status/initial-connection
recovery, ten-second status/token request deadlines, Retry-After handling, and
stale-response protection after disconnect or provider/session replacement.
Healthy wake events add no auth requests. Existing data and sync modes remain
unchanged. Dropbox adapter failures now preserve transient versus terminal
categories. Incident titles include a sanitized failure category.

Before the archive correction, Docker release checks passed: zero audit vulnerabilities, lint,
typecheck, six artifact checks, 3,060 unit tests (one existing skip) with the
configured per-file coverage gate, 117 Chromium journeys, five PWA checks,
production app/recovery builds and site contract export. Four browser recovery
journeys preserve pending local manual work for both providers. Release scope
is core-app patch v1.6.3, with no agent package, Worker or site source change.
No commit, push, release, deployment or live-account mutation has occurred.
See `app-status.md` for scope and verification detail.

## September 18 v1.6.2 release candidate

The core sync, deletion, invoice, empty-state and account feedback changes are
ready for the approved production release. The complete local Docker release
gate passes: dependency audit, lint, typecheck, build, 3,024 unit tests (one
existing skip) with per-file coverage, 112 Chromium journeys, five PWA checks,
and site contract/recovery exports. The site and app will be released from
separate reviewed commits; live deployment evidence belongs to the private
readiness record. Existing orphaned records require a separate explicit
recovery decision and are not changed by this release.

## September 18 account deletion loading feedback — validated locally, unreleased

The confirmed Delete All Data button now uses the shared Button spinner while
the existing cloud-wipe and local-clear flow runs. Account tests, the browser
backup/delete/restore journey, lint, typecheck, and production build pass.
Changes remain uncommitted and undeployed.

## September 18 expense deletion feedback fix — validated locally, unreleased

A real Yjs expense deletion removed the record but returned no value, so the
editor wrongly reported that it no longer existed and left its confirmation
open. Expense and shared collection deletion now report success from the
pre-delete existence check, and the local Yjs type matches the library's void
return. Related legacy collection helpers use the same rule. Focused tests,
the full unit/coverage gate (3,023 passed, one existing skip), lint/typecheck,
the production build, and eight Chromium expense journeys pass. Changes remain uncommitted and
undeployed; details are in `app-status.md`.

## September 18 core integrity audit validated locally — unreleased

The sync/deletion/invoice audit closes reproduced historical cascade, completed
billing replay and IndexedDB commit-acknowledgement gaps without new entity
schemas or dependencies. The full Docker release-check sequence passes, including
3,021 unit tests, per-file coverage, 111 Chromium journeys and five PWA checks.
Changes remain uncommitted and undeployed; existing orphaned records still need
an explicit recovery decision. See `app-status.md` for behavior and validation details.

## September 18 core v1.6.1 phone UI patch released

Core `f7d943476e6691a419664ad600cb82767e57bd25` is tagged and published as
`v1.6.1`, and its tested app archive is live at `https://app.tasktime.pro`.
The local Docker release gate and exact-source CI `35275494467` pass. Private
preparation `35275536860` and deployment `35279686536` pass with the existing
`live` billing mode and archive SHA-256
`cb9168f1db75d8c163e7bf7b139fb2c39538aefaeb90d65fb4fd41781eeceb8c`.
The preparation gate passed 102 Chromium journeys on the first attempt and one
existing mock Drive navigation-abort fixture on its second retry; all five PWA
checks passed. Live HTTP checks found 28 served files identical to the approved
archive, matching HTML after Cloudflare's JavaScript-detection injection, and
successful app routes. The public site and shared Worker were not deployed;
published agent artifacts are unchanged. Physical-phone acceptance remains a
separate owner check. Details are in `app-status.md` and the private readiness
record.

## September 16 production launch released

The new public site is live at `https://tasktime.pro`, and app v1.6.0 is live at
`https://app.tasktime.pro`. Core tag/release `v1.6.0` identifies tested source
`cbe52a0`. General catalog, no-card trial, Checkout, Portal and the staged client,
Reports and hosted-email controls are enabled. Free draft editing, PDF export,
local records and cloud sync are preserved.

Exact-source CI and the production artifact gate pass: 2,888 unit tests with
per-file coverage, 96 Chromium journeys and five PWA checks. The production gate
has one retained mock-Drive cancellation flake that passed on retry and in three
additional runs without retries. All 25 live app route/asset/TLS checks and the
isolated email/PDF smoke pass; 17 site checks and returning-user recovery proof
are retained. Edge shows the expected Pro trial, four clients, sync ready and
no billing warning after loading the final app assets.

Bridge/MCP, OpenClaw and Claude 1.2.0, marketplace 1.4.0 and ClawHub skill 1.3.0
are published and verified. No extra paid hosting resources or plans were added.
The owner accepted production and approved launch cleanup on September 16.
The launch rollback and staged Pages builds are removed; historical hosting
versions and customer data remain. First legitimate paid/send monitoring follows;
Dropbox broad-public developer status still needs confirmation in its owning
account. Private launch readiness owns the exact operational evidence. Earlier
dated entries below are historical checkpoints, not current approval blockers.

# Delivery Status — Overview

## September 15 production promotion approved

The owner authorized continuing the app and root-site launch with necessary
Cloudflare operations, no additional expenses, and cleanup only after successful
verification. The retained Cloudflare production deployment is the approved
root rollback fallback; the original independent archive is unavailable. Private
site checkout access is verified. The recovery candidate is ready for its clean
source checkpoint and independent site pin. Final commercial availability and
per-device migration acceptance are being reconciled before the root switch;
both users have confirmed their active devices. The owner explicitly approved
completing live billing, and the confirmed domestic tax registration is now active.
Production billing still awaits its runtime configuration and live verification. The private
execution record owns deployment identities, artifact hashes and live results.
Earlier dated notes below remain historical checkpoints.

## September 15 root launch continuation — recovery validated locally

The owner approved the notice UI and proceeding with Phase 4 including the public
root. The temporary readonly recovery reader and real site download are now
implemented in the local candidate. Core gate: 2,887 unit tests, 96 Chromium and
five PWA checks; targeted recovery journeys also pass in Firefox and WebKit.
Site gate: 10 native tests, 20 Chromium checks and one optional diagnostics skip;
nine preview checks pass. The retained production worker rehearsal confirms
online complete export and reopening an old bookmark after an offline visit.
That worker can still show its original app shell offline, so known-profile
retirement remains part of cutover. No workspace mutation is performed by the
reader. See `status/app-status.md` and private launch readiness for evidence.

Root and app deployments remain unchanged. Publication is blocked on the private
site checkout credential and an explicit rollback decision: the original GitHub
archive expired, while Cloudflare retains the successful original deployment.
The recovery bundle is still marked dirty; clean source pins and final CI/artifact
preparation must follow the reviewed commits. No new commit, push, merge or
deployment occurred in this recovery continuation. Live billing remains disabled
under the owner's separate Tax-registration deferral. These current facts
supersede the historical preparation-only and visual-fixture notes below.

## September 15 approved launch policies — local validation complete

Owner-selected allowance, grace, refund/support and retention policies are
implemented in local preparation. Worker 384 tests/typecheck, core pricing
regression and site release gate pass. Local services are healthy. See
`status/app-status.md` and the private subscription launch decision packet for
evidence and remaining Stripe/Resend checks. No commit, deployment, production
billing activation or root-site publication occurred.

## Phase 4 continuation — September 15

The owner requested Phase 4 continuation. Fresh read-only inventory confirms both
existing deployments and disabled billing controls. The earlier Google disconnect
UI issue is fixed locally with red/green and Chromium proof. The final app gate
passes 2,870 unit tests, 91 browser checks and five PWA checks, plus static/build
checks and zero audit findings. App status and private readiness retain the
branch-only commit scope. The owner subsequently approved committing/pushing the reviewed changes to
`update/launch` and CI/artifact preparation. Site update preparation is also
authorized, with publication held until the owner previews and confirms the
recovery notice UI and its data-recovery checks pass. Main promotion remains
a separate action. The new local notice is a visual fixture only; production
data detection/export and old-worker recovery are not yet implemented.

## Overall state

TaskTime Pro is in production. The core local-first app, Drive sync, invoicing/reporting, public site, and local agent bridge are implemented. Current work focuses on assurance, compatibility, TypeScript migration, and publishing/validation follow-through rather than greenfield delivery.

## Current phase

- September 15 uncommitted follow-up: app/site DebugBundle separation and
  VAT-inclusive acquisition are locally validated; the site has a new generic
  social-image slot. The owner's replacement JPEG now passes all-page metadata
  and image checks; no commits were requested. Live Stripe inclusive Prices and
  active Tax defaults are configured; the invoice VAT ID is saved and separate Tax registration is owner-deferred.
  Inclusive-price reconciliation and production trial configuration now pass
  384 Worker tests and typecheck;
  the full isolated Stripe test lifecycle passes. Brief retryable account-operation
  warnings now wait for bounded recovery; 69 related billing tests, changed-hook
  coverage, core typecheck and lint pass. Local billing/Dropbox
  availability is restored. Both deployed
  sites are unchanged; see `app-status.md` and site `STATUS.md`.

- September 15 app-first launch is live at `https://app.tasktime.pro`, using
  exact core `fa22870`. The complete artifact gate and 24 live checks pass;
  one long sync browser journey needed a retry. Real Edge Google sign-in/initial
  sync and Dropbox connection/Sync Now pass. The Google disconnect UI issue is
  fixed in the uncommitted Phase 4 candidate with unit/browser proof. Owner
  data/workflow acceptance is next. Root deployment and DNS remain unchanged;
  root publication and its recovery notice require the owner's separate go-ahead.
  Test/documentation follow-ups remain on `update/launch` after automatic approval
  review rejected a further core main push. See `app-status.md` and private
  readiness evidence. This supersedes the historical preparation checkpoints below.

- September 15 launch preparation is approved for an `update/launch` branch
  commit/push and GitHub CI, without main promotion or deployment: core `1.6.0` with
  browser SDK `1.7.1` passes the full core and local agent gates. Private overlap
  and artifact-target guards pass. Owner-approved database rollback copies are
  retained privately and pass local SQLite and Cloudflare-runtime migration
  checks. OAuth additions are owner-confirmed; live sign-in and production
  migration/configuration evidence remain prerequisites.
  `app-status.md` and the private readiness record retain the evidence. No
  deployment occurred; root publication still requires the owner's separate
  go-ahead after app-origin testing.

**Program Phase 3 locally validated; Phase 4 launch preparation next**

- Final audit and user-authorized local checkpoint (2026-09-14): saved invoice
  drafts, timer editing, Planner menu spacing and restored Unbilled cards pass
  the complete core gate (2,815 unit, 90 Chromium and 5 PWA checks), focused
  Firefox/WebKit and Ljubljana timer checks, and local packaged/live MCP checks.
  Audit fixes cover client-only expense refresh, unissued unsaved previews and
  exact canonical/vendor bridge parity. The site independently passes its gate;
  its desktop hero overflow is fixed and invoice captures are refreshed for the
  new Drafts UI. The clean committed core public contract is reviewed and pinned
  in the separate site checkpoint. Evidence lives in `app-status.md`,
  `agent-status.md` and the site's `STATUS.md`.
  Local commits on `update/launch` are authorized; no push, version bump, tag,
  publication, deployment or production-data change is included. Phase 4 retains
  exact-revision gates, live-provider evidence, legal/commercial sign-off,
  repository/environment protection and staged launch/rollback approval.
  The release train is core `1.6.0` plus the changed bridge/MCP metadata, OpenClaw
  and Claude bundles. Historical dated `uncommitted` notes below describe their
  original validation state, not the state after this checkpoint.

- Saved invoice drafts (2026-09-15, local/uncommitted) now have a complete UI
  preparation workflow and shared agent operations. The full app release gate,
  cross-browser draft checks and live local MCP/bundle checks pass. See
  `app-status.md` and `agent-status.md` for evidence and the separate future
  core/agent/site-contract release scope.

- Brand and trademark guidance (2026-09-12, local/uncommitted): the public core
  repository now has `TRADEMARKS.md`, linked from the README, to distinguish
  official TaskTime Pro branding from permitted AGPL/MIT-0 use and truthful
  references to forks. Include it in the reviewed `update/launch` release
  candidate; legal/commercial approval and publication remain Phase 4 gates.

- Public navigation and onboarding polish (2026-09-11, local/uncommitted):
  every public-site layout now treats `/` as the sole Home route in visible
  navigation and discovery copy; the duplicate homepage route is removed from
  source, sitemap, app redirects and generated output. Public headers span the
  viewport with responsive edge insets; page content keeps its existing readable
  width. The app onboarding welcome step no longer links back to the public site
  and restores deliberate top spacing above the icon without changing the shared
  modal contract. Privacy and Terms links now use those concise labels in
  onboarding, Account and public-page navigation. Focused unit/browser,
  build-contract, PWA, lint and typecheck checks pass; the independent site
  gate passes with zero audit findings, 7 native tests, 51 pages and 8 Chromium
  checks. No commit, publication or deployment occurred.

- Site ownership transfer (2026-09-11, user approved): the existing private
  site repository is now `tasktimepro/tasktime-site`, with its history, branches
  and pull requests preserved and local `origin` updated. Core remains public;
  site and infrastructure remain private. No new source push, main promotion
  or deployment occurred. Ownership notes are reconciled locally; Phase 4
  retains protection/access setup and clean approved publication provenance.
  See `contracts/site-distribution.md`, `TODO.md` and site `STATUS.md`.

- Three-repository local checkpoint (2026-09-11, user approved): this commit
  retains the core site extraction, grouped development, dependency remediation
  and copy/metadata reconciliation. Site source is retained in its own initial
  local commit `5a366f2` before core records the old `blog/` removal; private deployment
  preparation is checkpointed separately. Historical `uncommitted`/no-initial-
  commit labels below describe validation before these checkpoints. No remote
  creation, push, main promotion, version bump, tag, publication or deployment
  is included. The broader core `1.6.0` and affected-agent train below remains
  the planned release scope; this slice adds no agent runtime/schema changes.
  At that checkpoint, Phase 4 still required remote source retention and a clean
  approved public contract; the pinned dirty candidate is not publication provenance.
  Pre-commit rerun passes with CI settings: zero core audit findings, 2,709
  unit tests with coverage, all 63 Chromium smokes and 5 PWA checks. The full
  site gate and private assembler tests/workflow YAML checks also pass.

- Core dependency and Free/Pro copy follow-up (2026-09-11, uncommitted) resolves
  both additional migration blockers locally. Core's 57 audit findings are now
  **zero** after a coordinated same-major dependency update and clean install;
  both audit-first release gates remain enforced. Core release checks pass
  (2,709 unit, 62 browser, 5 PWA), plus a real-PDF regression and agent gates.
  The running local app also uses the patched dependencies. Site independently
  passes audit, 7 native tests, 52-page validation and 6 browser checks.
  Historical no-paid-tier claims, advanced-report metadata and legal/pricing
  copy now preserve Free core and disclose optional Pro/Stripe concisely.
  Remaining program work is Phase 3 UI/visual review and Phase 4 approvals,
  source/provenance, legal/commercial sign-off and controlled launch—not an
  authorization to publish. Details: `app-status.md`, `tasktime-site/STATUS.md`
  and `docs/subscription-claim-inventory.md`.
- Local Docker orchestration (2026-09-11, uncommitted) now uses a persistent
  `tasktime` group: app 3101, optional site 3102, and existing local private
  services. Stop/Play retains the prepared containers; `tasktime-tools` isolates
  validation. The rename preserved Worker state, browser origin and volumes.
  Core/site gates and grouped stop/start health checks pass; see `app-status.md`.
  This does not couple repository builds/releases or change production.

- Public site repository extraction (2026-09-11, uncommitted) is locally
  validated. `tasktime-site/` is an independent ignored checkout with its own
  lockfile/Docker/CI/artifact; core builds only `dist-app`. Public metadata uses
  an explicitly reviewed schema-1 snapshot. App public links/redirects and PWA
  exclusion preserve the boundary without changing Yjs, sync, billing, or agent
  runtime contracts. See `contracts/site-distribution.md`, `app-status.md`, and
  the nested site's `STATUS.md`. Full core and site gates passed. Phase 4 now
  tracks three-repo main promotion, clean snapshot, protected independent
  deployments, security/content approval and retained rollback bytes. Site
  remote retention is now complete as recorded above; all deployments remain
  pending and production state is unchanged.
  The follow-up site-only Astro 7.3.2 remediation clears all 13 inherited audit
  findings locally; the standalone gate and 51-page parity checks pass. Required
  high/critical audit enforcement is prepared, with fresh candidate evidence and
  remote dependency-monitoring activation still tracked in Phase 4.

- Earlier local checkpoint `e867ac8` (2026-09-11) includes the preceding app, billing,
  UI, site, test, documentation, and generated OpenClaw changes. Dated validation
  entries below retain their original pre-commit evidence; their `uncommitted`
  labels describe that earlier state. Release scope is core minor `1.6.0` plus
  the affected bridge/MCP Registry and bundled-agent release train described in
  `agent-status.md`. Versions remain unchanged. No push, tag, publication,
  deployment, or live billing mutation is part of this checkpoint.

- Billing-state pre-launch audit is hardened locally (2026-09-10, uncommitted):
  signed expiry/clock safety now covers open tabs and delayed responses, offline
  key reuse respects the license window, stale online actions are discarded,
  and account-switch/queued-client races are fenced in browser and agent paths.
  Client/email/report recovery uses one shared classification. App coverage
  passes 278 files / 2,694 tests, lint and both typechecks pass, and nine targeted
  browser scenarios pass across Chromium, Firefox, and WebKit. The 50-page build,
  six PWA checks, and 355 Worker tests pass; the local D1 suite requires the
  explicitly recorded 15-second test budget. Evidence is in `app-status.md`;
  production billing switches, live Stripe/provider state, and deployment remain
  unchanged. Live launch configuration/canary approval is still separate.

- Task/account/category polish is implemented locally and uncommitted:
  explicit Disable recurrence/Enable recurrence actions with calendar icons in
  task menus; category modals and
  category-only original-color borders/dots across expense surfaces; dynamic
  category references, category-only recurrence propagation, and inline category
  management that restores the expense draft;
  stable sidebar-title expansion; direct Account provider sign-in; collapsible
  client-gated project billing/planning; actionable invoice links; and matching
  centered Today/Upcoming rows. Expense tabs clip vertical overflow, and shared
  three-dot menus leave scrolling available, then close after an 8px movement
  threshold. Recurrence actions now match neighboring menu spacing; disabled
  schedules replace list recurrence tags with a neutral calendar-off `Disabled`
  tag and show it inline with the repeat description under Schedule in task
  details while titles remain clean.
  Planner uses the same red running-timer dot as the global timer. Project identity
  now uses the closed-folder glyph for attached Planner projects, the neutral
  Projects page heading, and the project-detail heading. Project detail shares
  project-first/client-inherited/neutral color resolution with the Dashboard
  widget, while project cards retain their colored border and text-only titles;
  active and archived project grids match the Clients page's 24px gap and card
  padding. Project status tags sit immediately after the title while menus stay
  aligned at the far right, and the cards
  omit the redundant Most recent display while preserving activity-based sorting.
  Project-list and client-dashboard project cards share a flexible details row,
  keeping invoice/deadline pills right-aligned beside the text until narrow
  widths require wrapping instead of reserving separate footer space.
  Client identity now mirrors this treatment: the Clients heading uses the
  shared users glyph in neutral muted-foreground, client detail replaces its color dot with a color-resolved
  single-user icon matching Planner attachments, and project-card client names navigate directly to their client
  without opening the project card.
  Planner projects without an explicit or inherited color now retain the same
  4px identity border with the neutral border token.
  Planner expense accents are dotted on the left edge only, preserving category
  colors and neutral fallback. Project and Client heading totals hide on phones
  so the existing icons, titles, sort controls, and create buttons retain room.
  Client and project dashboard Unbilled cards were subsequently restored to the
  user's reference: heading above compact work and optional expense amount rows.
  Compatibility and browser checks are recorded in `app-status.md`. Follow-up review fixes
  stale recurrence edits/menu intent,
  hidden rate validation, and retained Dropbox recovery. Final local gates:
  2,639 unit tests across 277 files with coverage, lint, and typecheck passed on the
  preceding draft-state source; all nine affected scenarios passed in Chromium, Firefox,
  and WebKit after the complete 59-case Chromium smoke gate. Six PWA tests,
  production build, and agent bridge/bundle smoke also passed for that baseline.
  The follow-up neutral Projects/Clients index icons pass 21 focused component
  tests, their focused Chromium scenario, lint, and scoped diff checks; the
  broader cross-browser, coverage, PWA, typecheck, and build gates were not rerun.
  Dashboard task rows now fully honor the existing running-project lock: another
  task in that project cannot open task details through its title or overdue date
  in Today, Upcoming, or Tasks, while the timer owner and paused timers stay usable.
  Red/green coverage passes 31 focused component tests; the broader Dashboard
  unit gate passes all 100 tests across 16 files, and all seven Chromium Dashboard
  scenarios pass at desktop and phone widths. The focused interaction also passes
  in Firefox and WebKit. Full lint, typecheck, and scoped diff checks pass;
  coverage, PWA, and build were not rerun for this interaction fix.
  A text-only follow-up removes the redundant `Next 7 days` subtitle from the
  Upcoming header while retaining the same scheduling window; 18 focused unit
  tests, the Chromium multi-width Dashboard scenario, and full lint pass.
  Agent bridge/OpenClaw tool metadata and the vendored bridge
  are updated locally; their release assessment now accompanies core 1.6.0.
  Nothing has been committed, published, or deployed for this slice.

- No-client billability is corrected locally across saved/live dashboard hours,
  report/export totals, unbilled projections, automatic task marking, and task
  controls/Kanban badges. Sent/paid invoice move preservation is verified;
  stale drafts and legacy eligibility/entry-lock gaps are corrected. The final
  2,569-test coverage gate, lint, typecheck, and app build pass. Fifty Chromium
  and six PWA smoke checks also passed; the final Kanban-only guard has focused
  and full coverage verification. Exact evidence boundaries are in
  `app-status.md`. Changes are uncommitted and undeployed.

- Phase 3 continuation is recorded in this local commit checkpoint: Expenses
  overview/interactions, Dashboard dots/empty states/axis sizing/live tracked
  time, and Yjs/Billing provider identity fixes. All current source changes and
  user TODO edits are included; homepage work was already committed in `faa4441`.
  Latest checks: 2,525 unit tests with coverage, eight targeted Chromium cases,
  lint, typecheck and app build passed. Earlier broad smoke/PWA evidence remains
  separately dated in `app-status.md`. Continue remaining UX work from TODO in
  the next thread. Release scope remains core minor `1.6.0`; no agent artifact
  release is needed. No version bump, tag, push, publication or deployment.

- Reports hot-update regression is fixed locally: Yjs and billing context
  identity are independent of provider UI dependencies. First lazy Reports
  navigation after a shared Modal update is covered with enforcement enabled.
  All 2,513 unit tests, 47 Chromium smoke scenarios, six PWA checks, lint,
  typecheck, and the production build pass. The existing localhost workspace
  also retains advanced report access, totals, and In sync after the same hot
  update. This fix is included in the continuation checkpoint and remains undeployed.

- The Expenses overview slice is complete locally: neutral summary cards,
  spending/category charts, and recorded activity with phone ordering and
  offline support. Follow-up refinements add a 30-day activity modal, padded
  hover rows, and full-card navigation for recurring/upcoming summaries.
  The original expense list and tabs are restored and retained.
  Full unit/coverage, Chromium smoke, PWA, lint, typecheck, and build checks pass;
  details are in `app-status.md`. This slice is included in the continuation checkpoint and remains undeployed.

- The dashboard readability slice is complete locally: separate Today/Upcoming,
  four fixed-timeframe summaries, preset-period reports, and a neutral stacked
  billable/non-billable chart. Phones put action panels first and scroll summary
  cards horizontally. Canonical billing/payment history, currency fallback and
  offline chart loading are covered. Reports include compact preceding-period
  trends, an aligned chart container with its legend beside the title, and an
  8h minimum axis ceiling. Validation and the successful/cached exchange-rate
  crash regression are recorded in `app-status.md`. This is a local checkpoint,
  with no deployment or persisted-contract change.
  The Projects widget now uses 14px folder outlines in the original project
  colors, inherited client colors when absent, and a neutral fallback. Its
  metadata lines align with the folder edge like expense metadata. Project/client
  navigation and light/dark phone layouts are verified. Dashboard tracked-time
  displays now include a read-only minute-sampled active-timer projection;
  financial calculations and other views retain saved-record semantics.

- Phase 3 homepage copy now leads with “Run your freelance business. From task to invoice.” in the centered hero, with one primary app action and compact
  Local-first/Open source/Works offline trust chips. The one-person-team section
  follows the product visual; optional AI assistance follows billing with
  concrete unbilled-time and invoice-draft examples linked to the existing guide.
  Capability descriptions are shorter, and sync stays with privacy. Capability
  and ownership cards now share the app's icons and consistent spacing; the
  third ownership card explains export/restore. Projects uses a closed folder
  throughout the app and homepage. The
  production build, lint, typecheck, and all five PWA regressions pass, including
  section order and keyboard navigation to the guide. Desktop, tablet, and
  narrow-mobile visual checks pass locally. Final product captures remain
  pending. Homepage and shared project-icon changes are included in the same
  local Phase 3 checkpoint; publication remains pending.
- Release scope: next core-app minor release (`1.6.0` from `1.5.0`); no published
  agent artifact changed. This checkpoint makes no version bump, tag, push,
  publication, or deployment. See `spec/roadmap.md` for the remaining program.
- Direct browser-to-Google Drive sync is deployed. The active Worker retains only OAuth/token control-plane duties, rejects the retired `/drive/*` route without CORS permission, and permits the exact `http://localhost:3101` production-equivalent preview origin. The temporary staging resources, local secrets/configuration, tests, and runbook have been removed. Privacy, terms, contracts, specifications, architecture, contributor guidance, and public copy state the direct browser-to-Google Drive boundary.
- Offline lazy-document navigation now short-circuits before any remote Drive work and subscribes locally; a red/green provider regression covers the cached-manifest case that previously produced failed offline requests. Focused provider tests, app typecheck, lint, and diff checks are green.
- Direct Drive auto-sync now batches project-note typing after a 1.5-second quiet period, retries genuine pending work after active-sync/Web Lock contention with bounded backoff, and checks for remote changes every five minutes only while Sync mode is visible.
- The browser retest confirms offline navigation now produces neither Drive requests nor upload errors.
- Provider-neutral cloud sync is deployed with direct Google Drive and Dropbox data planes, active-provider hosted identity, and explicit user-initiated transfer in either direction. The moved-source recovery is provider-symmetric: it offers the recorded destination first and permits source reuse only after verified source-only deletion and a complete local push-only seed, without touching the recorded destination.
- Core app `1.5.0` passed GitHub CI and serves the Dropbox announcement, RSS entry, and sitemap route. The existing production Google Drive session survived the upgrade and returned to In sync after an explicit Sync Now with no new app, Yjs, or sync errors. The compatible Worker passed typecheck and its complete focused test suite, enables transfers, and returned a valid provider-specific transfer authorization URL without starting an automatic move. The full real-account transfer and moved-source replacement journeys remain proven by local production-preview canaries.
- Gradual TypeScript and testing-infrastructure improvements
- Installed OpenClaw validation and remaining agent-directory publication checks
- Program Phase 2 has been narrowed to a supervised two-user cutover. There is
  no general-purpose migration protocol or permanent migration UI: each user
  reconnects the same provider on the pristine new origin, with the existing
  complete validated backup/import as fallback, and keeps the old origin intact
  until verification. Exact app/marketing/Worker/agent origin handling and
  isolated `dist-app`/`dist-site` outputs are prepared locally. Focused app and
  provider tests, lint, typecheck, the real 50-page production build, agent
  bundle smokes, and the complete Worker test/typecheck gate pass. The private
  supervised cutover/rollback checklist covers PWA, Push, email, billing,
  metrics, agent re-pairing, the minimal two-Pages-project/one-Worker topology,
  an immutable root rollback artifact, single deployment authority per project,
  and a post-window inventory/cleanup gate. No live domain, configuration,
  deployment, or user-data action occurred.
- OpenClaw durability implementation and automated release evidence are complete: credentials/contracts are reconciled, status/logging are hardened, browser refresh and same-profile reopen continuity are covered, and the native plugin owns one Gateway-lifecycle bridge while generic MCP/Claude stdio remain supported. CLI/Gateway alignment and disposable-profile migration/rollback now pass on `2026.7.1-2`; the final installed plugin/browser multi-turn acceptance remains pending.
- Approved product backlog after its recorded ambiguities are resolved
- The subscription/license implementation is present locally across Worker/D1,
  signed status/license, shadow billing UI, active-client transitions, the Free
  Reports Overview/static Pro boundary, hosted-email quota/status recovery, and
  browser/agent policy. Fresh real-local D1 execution covers ordered migrations,
  one-time trial contention, 251-way founding capacity, atomic email quota,
  one-sided and compatible same-Stripe-owner provider transfers, conflicting
  dual ownership, fresh-account transfers in both directions, target-side
  mutation races, cross-D1 recovery, and alternate-binding restore. The private
  Worker gate passes 33 files / 307 tests plus typecheck and both migration/schema
  verifiers; the public release gate passes 259 files / 2,437 tests, coverage
  thresholds, 39 Chromium smokes, four PWA smokes, and the 50-page merged build;
  changed agent artifacts pass their
  local release smoke. The bounded main-account Stripe test-mode rehearsal now
  passes founding/standard Checkout, Portal, webhook ordering, renewal and
  failure recovery, pause, matched dispute, cancellation, reconciliation, and
  synthetic-object cleanup. All production controls remain false and no remote
  migration, live Stripe mutation, deployment, paid-copy publication, or
  production canary is part of this local phase. The
  approved boundary is Free with one active client and a current-local-month
  Reports Overview, Pro with unlimited active clients, advanced Reports/exports
  and hosted sending, and a `EUR 39/year` founding offer for the first 250 paid
  canonical principals followed automatically by the `EUR 59/year` standard
  offer for new purchases. Email allowance, paid grace, tax-inclusive versus
  additional-tax presentation, both live Stripe mappings, remaining payment/
  refund/Portal/support policy, Dropbox broad-public access, the
  app-origin migration, homepage work, and live release approval remain gates.
  Local green evidence is not release approval. The Phase 1 code candidate is
  complete. A later uncommitted UX hardening follow-up gives every surface the
  same derived plan-plus-connection state and Get Pro decision, keeps cached Pro
  distinct from temporary transport loss, permits the universally Free first
  client before status resolves, and gives hosted Send state-specific offline,
  automatic-reconnect, or explicit-reconnect guidance. Locked advanced Reports
  previews now consume the same state: a fresh browser offers Get Pro while
  offline and reconnect paths retain their own recovery guidance. It passes 278
  files / 2,668 tests with coverage, lint, typecheck, the 50-page build, and a
  fresh isolated browser review; production controls remain off.
  The synthetic billing-state preview has been retired in favor of a guarded
  loopback-development pre-production sandbox. It runs the normal app against
  local Worker/D1 and real Stripe test-mode Checkout/webhooks. Hosted email now
  uses the normal Pro entitlement, local quota/idempotency, recovery, and
  configured Resend delivery path, while the visible product UI stays
  production-like without sandbox-only notices and every tracked production
  control remains unchanged. The supported app
  command is now the ordinary `make dev`; in the operator checkout it prepares and starts the app,
  local Worker, Dockerized Stripe listener, and bounded scheduled recovery runner
  as one attached Compose stack.
  It fails early when hosted email lacks its ignored local Resend credential and
  regression-checks that no production-enabled Worker control is disabled by the
  local overlay. `make dev-billing-sandbox` remains a compatible alias and
  `make dev-core` remains the explicit public/diagnostic fallback.
  The private per-service commands remain diagnostic escape hatches rather than
  the normal workflow. Program Phase 1 is
  complete locally. An owner-driven browser Checkout has also completed in
  Stripe test mode and converged to canonical Pro locally; this remains test
  evidence, not launch approval, and requires a current exportable Stripe test
  secret whenever it is repeated.
  Checkout now prefills the locally verified connected-account email as optional
  billing contact data and lets Stripe collect only the address detail it needs;
  it does not force a full address or separate TaskTime Terms checkbox. Existing
  Stripe billing email wins, and the contact never becomes identity or entitlement
  authority. Final live tax and consent treatment remains a Phase 4 approval.
  Hosted-email recovery is fully automatic and no-send after initial provider
  contact: it survives a crash between the retained terminal marker and Yjs sent
  metadata, hides Send as soon as the customer copy is confirmed, and bounds the
  modal spinner while list/focus recovery continues. Scheduled billing recovery
  also terminalizes a matching missed Checkout event and its founding allocation
  idempotently. Canonical local D1 schemas were adopted from preserved backups
  with row-equivalence, integrity, foreign-key, and strict schema attestation.
  Its sanitized test-mode evidence and cleanup result are retained in the
  private operational record. Owner-only
  live configuration, deployment, and launch inputs remain separate Program
  Phase 4 gates.

The July 2026 deep validation and Critical/High remediation are complete. Evidence, decisions, and the full release gate are recorded in `status/critical-path-assurance.md`.
The repository now has a zero-diagnostic TypeScript baseline enforced by the release gate; gradual source migration remains ongoing.

## Completed

**Foundation reconciliation — agent-kit 0.2.0**

- [x] Installed project-aware rules, skills, prompts, ownership manifest, and version marker.
- [x] Created populated specification, contract, architecture, environment, evaluation, and multi-layer status documents.
- [x] Validated required files, prompt/skill metadata, local references, environment coverage, route representation, Yjs collection coverage, and template removal.

**Critical-path assurance — July 2026**

- [x] Remediated sync/storage, backup/restore, billing/undo, reports/export, and agent trust findings.
- [x] Passed unit/integration coverage, lint, production build, browser/PWA smoke, and packaged live-agent gates.
- [x] Established and enforced a zero-diagnostic repository-wide TypeScript release baseline.

**Invoice cancellation — July 2026**

- [x] Delivered the six-slice terminal cancellation lifecycle across Yjs recovery, browser UI, reports/exports, backups, and agent surfaces.
- [x] Preserved invoice audit records and numbering while conditionally releasing only source work still owned by the canceled invoice.
- [x] Hardened first-commit eligibility, persisted-plan validation, late-arriving source reconciliation, protected later billing, and paid-only mark-as-unpaid behavior during pre-ship review.
- [x] Passed the final full release gate and packaged live-agent cancellation smoke; the `v1.2.0` release was published before the later direct-Drive releases.

## Blockers and open questions

- See `spec/ambiguities.md`. Remaining decisions concern future product work or compatibility-policy evolution; none blocks the completed assurance slice.
- Subscription launch-only allowance/grace/tax/legal/Stripe/Portal/support and
  remote-operation decisions remain explicitly unapproved and fail closed; see
  the private launch-decision packet. They do not block the completed local
  Phase 1 candidate.
- Provider-neutral sync is promoted as core app `1.5.0`; the compatible Worker/app rollout and focused production canary are complete. Agent bridge `1.1.0` is public on npm and MCP Registry, OpenClaw `1.1.0` is public on npm and ClawHub, and the repository-backed Claude `1.1.0` / marketplace `1.3.0` artifacts ship from `main`. The unchanged ClawHub skill stays at `1.2.1` and did not require republication. Broad Dropbox availability has one external two-part follow-up: obtain App Console production access, then pass the non-destructive post-approval sign-in/token/direct-file canary. This does not change the shipped code or direct-data privacy boundary.

## Quality gate

Behavior changes require red/green tests and Docker-backed checks. Documentation-only foundation changes require metadata, link, reference, and preservation validation; they do not require application tests unless executable files also change.
