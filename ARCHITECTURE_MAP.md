# TaskTime Pro Architecture Map

```text
Browser / PWA
├── src/App.jsx + src/components/          UI composition and workflows
├── src/hooks/                             React-facing entity and behavior APIs
├── src/domain/                            Pure/central business operations
│   └── entitlements/                      Shared semantic UI/agent policy (enabled in production)
├── src/config/billingFeatures.ts          Fail-closed defaults + explicit release flags and guarded loopback sandbox mode
├── src/config/origins.ts                  Exact marketing/app/migration/Worker/agent origin roles
├── src/contexts/BillingContext.tsx        Normal Worker-backed billing client and lifecycle
├── src/config/localReviewPricing.ts       Shared loopback app + public pricing review values
├── src/stores/yjs/
│   ├── YjsStore.ts                        Store facade and cross-document operations
│   ├── YjsDocManager.ts                   Multi-document lifecycle + committed IndexedDB barriers
│   ├── validation.ts + types.ts           Persisted schema boundary
│   └── providers/                         Shared cloud-sync core + Google/Dropbox adapters
├── src/agent/
│   ├── commands/                          Scoped business-command registry
│   ├── browser/                           Browser bridge endpoint and approvals
│   └── transport/                         Browser/bridge protocol
└── src/utils/                              Focused calculations and integrations
        │
        ├── IndexedDB (local, authoritative working copy)
        ├── sync.tasktime.pro OAuth/token control plane (optional)
        ├── Google Drive appDataFolder direct data path (production optional)
        ├── Dropbox App Folder direct data path (production optional)
        ├── provider-neutral hosted identity (production control plane)
        ├── Shared Stripe/D1 billing + public catalog/signed-license control plane (deployed)
        ├── DebugBundle endpoint (optional tasktime-app diagnostics; independent tasktime-site browser module)
        └── exchange-rate / email / push integrations as configured

Local agent process
└── src/agent/bridge/ → @tasktimepro/agent-bridge
    ├── loopback MCP server
    ├── pairing/session/scope/rate-limit enforcement
    └── WebSocket connection to the browser-owned command layer

Managed OpenClaw Gateway
└── integrations/openclaw/tasktime/ native plugin
    ├── generated native tool registrations
    └── one Gateway-lifecycle packaged bridge child using the same enforcement/protocol

Independent builds (no parent-source dependencies)
├── tasktime → dist-app: React, manifest, service worker, app redirects/fallback
├── tasktime → public JSON contract → reviewed snapshot in tasktime-site/vendor
└── tasktime-site → dist: homepage/pricing/blog/legal/agents, discovery, static 404 (no PWA)

Production topology (independently approved artifact deployments)
├── dedicated root Pages project → tasktime-site/dist → tasktime.pro
├── one permanent app Pages project → dist-app → app.tasktime.pro
├── one shared Worker + existing stateful bindings → app services and public catalog
└── old-origin recovery reader → readonly export for returning users
```

## Dependency direction

- `src/recovery/` reads existing old-origin IndexedDB updates into in-memory Yjs
  documents, then uses `utils/backupData.ts` for portable validation. Its standalone
  bundle is manually checksum-pinned into site; it never imports the app lifecycle,
  provider auth or runtime. See the temporary exception in `contracts/site-distribution.md`.

- Core source is public; site and infrastructure source are private. Repository
  visibility does not change the independent builds or public website output;
  see `contracts/site-distribution.md`.
- Components call hooks or focused domain/application functions; they do not create parallel persistence paths.
- Hooks expose Yjs-backed collections and mutations through `YjsContext`/`YjsStore`.
- `App.jsx` onboarding and `useExpenseCategories` only present existing data;
  neither creates starter records on mount. Explicit creation stays in the
  normal forms/hooks. Empty collections retain the existing store/provider
  pristine-device restore path without a separate seeding or cleanup lifecycle.
- Invoice UI hooks and agent commands share `stores/yjs/invoiceDraftOperations.ts`
  for guarded save, refresh, delete and finalization. `domain/invoices/invoiceDraftDocument.ts`
  translates existing UI composer snapshots and canonical agent lines. Source
  selection stays fixed on reopen; finalization revalidates full history before
  invoking the existing cross-document billing journal.
- `YjsContext.shared.ts` and `BillingContext.shared.ts` own context identity with
  no runtime provider/UI dependencies. Provider modules keep their existing
  hook exports; first lazy Reports navigation after a shared UI hot update must
  consume the already-mounted store and billing context.
- Dashboard `useDashboardHistory` observes validated existing active/archive maps
  and loads selected/comparison/current-period entry years plus legacy billing
  intervals.
  `dashboardMetrics.ts` projects saved actual time and canonical financial values;
  dashboard-only `useDashboardLiveTime` samples timer lifecycle state each minute
  and reuses stopped-entry identity matching. `useMetricsCalculation` overlays
  elapsed time only on tracked displays, keeping saved financial results separate.
  `DashboardHoursChart` loads Recharts from the separate precached chart bundle.
  Existing mutation handlers and the `/reports` entitlement branch remain owners
  of their behavior. See `spec/designs/work-and-time.md` for metric definitions.
- `domain/time/taskBillability.ts` owns current task/project/client classification
  for dashboard saved/live time, unbilled projections, browser reports, and agent
  summaries/exports, plus client-project guards for automatic billable marking
  and task controls. Invoice claim checks and persisted snapshots remain separate.
  Invoice previews/selectors and report eligibility evaluate complete legacy
  source evidence before filtering to the current project or visible period.
- `taskStateOperations` owns persisted recurrence pause/resume normalization for browser
  hooks and agent updates; `recurringUtils` applies it to scheduling consumers.
  `TaskRecurrenceMenuItem` exposes explicit Disable recurrence/Enable recurrence
  actions with calendar-off/calendar-check icons through
  both task menu variants. `TaskModal` saves schedule settings without the
  menu-owned control fields. `StartDateBadge` swaps a disabled task's recurrence
  schedule tag for the shared calendar-off `TaskRecurrenceDisabledBadge`; task
  details reuse that badge inline with the repeat description in Schedule while
  keeping task titles free of status decoration.
- `CategoryLabel` and `CategoryColorDot` render optional expense-category identity
  using the existing color-picker palette and compact dashboard expense-dot pattern; expense
  cards use the same validated color on their left border without a duplicate dot,
  and Planner expense items resolve that category color dynamically while retaining
  a neutral border when no valid category color exists. Expense accents never fall
  back to their associated project or client. Category records remain in the core
  Yjs collection. Expenses and recurrences
  reference those records by ID. `ExpenseModal` limits optional recurrence
  propagation to linked instances that still match the prior category and uses
  `ModalManager`'s existing modal stack and saved form state for its inline
  category manager. Stack drafts are transient refs scoped by entity/template
  identity, restored only across nested-modal returns, and cleared at completed
  or intentionally closed root boundaries. Account sign-in reuses the provider auth hooks.
  Retained Dropbox retries publish their auth result to other mounted consumers
  through the existing auth-change channel so the Yjs connection also recovers.
- `ProjectColorIcon` owns the read-only project-color precedence used by the
  Dashboard Projects widget and project-detail heading: project color, associated
  client color, then the neutral UI token. Planner and the Projects index use the
  shared closed-folder `ProjectIcon` for project semantics without adding stored
  fields or duplicating card-level color markers; the index heading explicitly
  uses the neutral muted-foreground token rather than the dashboard info accent.
- `ClientColorIcon` owns the matching read-only single-user identity in the client
  dashboard heading: saved valid client color, then the neutral UI token. The
  Clients index uses the shared `UserGroupIcon` with the same neutral heading
  treatment; project-card client controls route through `navigateToClient`
  without changing the project relationship.
- `ProjectCardDetailsLayout` owns the responsive lower-card split shared by
  `ProjectList` and `ClientDashboard`: project details flex on the left while
  compact invoice and deadline pills align on the right and wrap when required.
- Domain modules remain UI-independent and receive explicit inputs/dependencies.
- Expenses `expenseOverviewMetrics.ts` derives read-only projections from
  `useExpenses({ includeArchived: true })`, existing recurrence previews, and
  the shared currency conversion adapter. `ExpenseMetrics`/`ExpenseInsights`
  surround the original `ExpenseList`; `ExpenseSpendingChart` reuses the
  precached Recharts bundle. See the Expenses overview in
  `spec/designs/billing-and-finance.md` for scopes and currency fallbacks.
- `YjsCloudSyncProvider` lives in `providers/CloudSyncProvider.ts`; the previous
  `GoogleDriveProvider.ts` module is a compatibility re-export.
- `YjsCloudSyncProvider`, `CloudManifestManager`, and `CloudBackupManager` own the provider-neutral algorithm; `YjsDriveProvider`, `ManifestManager`, `BackupManager`, and Drive-named store/context APIs remain Google compatibility facades. Provider-neutral context/UI APIs expose Dropbox by default; an explicit build-time false value is an emergency UI opt-out, while matching Worker controls remain the fail-closed runtime boundary.
- `YjsContext.disconnectActiveCloudSession(...)` owns the active provider/session/generation lifecycle boundary used by Cloud Sync settings, Account sign-out/deletion, and agent deletion. User-facing flows expose only Disconnect and Wipe data & disconnect; provider-specific revoke and local-session operations remain internal adapters.
- Sync providers operate on Yjs document updates and manifests; they do not redefine entity business rules. Operational recovery keys are scoped by durable provider ID and connection generation, while generation-zero Google mirrors the legacy keys for rolling compatibility.
- The provider serializes connection, full-sync and lazy-document writers in both directions, including concurrent requests for the same archive. Web Locks cover other tabs; an internal queue preserves ordering when Web Locks are unavailable. Completion-callback loads use a separate serial queue under the owning lock, which is drained before the full pass resumes. Local edit subscriptions attach before any lazy I/O or queue wait.
- Both provider transports are direct per connection: the selected adapter keeps
  its short-lived token in memory and sends routine file requests only to Google
  Drive or Dropbox API/content origins. The Worker has no provider-data route.
- `useGoogleAuth` validates the retained Google session and explicit direct
  policy before `YjsContext` connects the provider. A transient status result
  keeps transport unresolved while bounded rechecks recover; it cannot fall
  through to the retired Worker file route.
- `utils/cloudAuthRecovery` supplies shared, bounded visible/online retries and
  auth-request deadlines. Both auth hooks use it for retained-session status;
  `YjsContext` uses it for temporary initial connection failures. Token providers
  retain their existing in-memory ownership and stale-generation fencing.
- `useDropboxAuth` also reads the verified account email directly from Dropbox
  after new/reconnected authorization and stores it only in the allowlisted
  origin-local auth-session record. UI consumers use that email for presentation;
  Worker hosted identity and billing remain keyed by stable opaque subjects.
- The lifecycle-selected provider session is also the hosted-service session.
  Private Worker code derives provider-separated subjects, resolves an opaque
  hosted principal, and links source/target identities only inside verified
  transfer. Legacy `driveSessionId` remains a compatibility field, not a hidden
  Google requirement when Dropbox is active.
- Agent commands call the same store/domain behaviors as the UI and never expose raw Yjs access to MCP clients.
- Pro enforcement is action-based through one pure entitlement policy with independent client/report/email rollout switches.
  `BillingContext` publishes its derived `entitlementState` with independent plan
  and connection dimensions, and the shared Get Pro action policy drives both
  Plan & Billing and Reports presentation. The Reports shell passes both into
  locked advanced previews so fresh acquisition, offline, automatic reconnect,
  and explicit reconnect remain distinct UI states.
  The shared recovery classifier also owns client-limit and hosted-email
  notices. `useBillingStatus` enforces open-tab expiry/clock safety, separates
  offline key lifetime from HTTP freshness, and removes stale online actions;
  billing storage and action callbacks fence delayed work to its exact account.
  It gates only transitions that create or restore another active client,
  advanced Reports/exports, and TaskTime-hosted Send—not `/reports`, its current-
  month Overview, visible static tab previews, shared calculations, or underlying
  bookkeeping records. A Reports shell chooses the Free Overview, a locked
  section-specific preview, or a lazy advanced module before protected history or
  report data is collected. Browser and agent adapters share client transition
  and report-scope policy; Worker-cost email rechecks canonical server state and
  quota independently. The first client is safe under every plan even while
  status is unresolved; only a verified lifecycle-bound assertion authorizes an
  unlimited-client transition or advanced Reports.
- The operator checkout's default `make dev` stack supplies an explicitly
  flagged Vite-development and loopback-only input to `BillingContext`. It keeps
  local services in the detached `tasktime` Docker Desktop group, optionally
  including the site's own Compose definition on 3102 beside the app on 3101.
  Stop preserves the group for Play; app tooling remains in `tasktime-tools`.
  Repository builds, dependency volumes and release ownership stay separate.
  It keeps the normal Worker-backed
  catalog, status, trial, Checkout, webhook, reconciliation, license, return,
  Portal, hosted Send, and email delivery-status paths. Hosted email uses the
  same Pro entitlement, local quota/idempotency state, and configured Resend
  adapter as the production design, while still requiring an explicit Send. A
  local scheduler invokes the same bounded Worker reconciliation used by the
  production cron; it can confirm previously contacted provider messages but
  cannot send them. Its sibling billing/email jobs are settled independently so
  one failure cannot abandon the other. Browser status checks remain D1-only
  and automatically converge the invoice list without a manual recovery button,
  including reapplying a retained terminal result when Yjs sent metadata was not
  persisted before a crash. It
  does not inject sandbox-only banners or developer-facing notices into product
  screens. Startup requires the ignored local Resend credential rather than
  allowing a partially configured hosted-email path to return 503 later. The
  preparation step idempotently applies the existing isolated Web Push schema
  before the scheduled sidecar begins. The
  local overlay is regression-checked so it cannot disable a Worker control that
  tracked production configuration enables. `make dev-billing-sandbox` remains
  a compatible alias; `make dev-core` is the explicit public/diagnostic fallback.
  Complimentary-access rehearsal reuses the production domain behavior while
  remaining isolated from production state.
  The sandbox is unavailable in production builds and is not release evidence.
- Implemented local license storage is origin-local and non-product: verified JWS
  records are subject-keyed and selected only through the exact active provider/
  generation/session-fingerprint binding plus trusted-time evidence. It never
  enters Yjs, provider sync, backup/export/import, or origin migration.
- Shared operations under `src/domain/time/`, `src/domain/tasks/`, `src/domain/work/`, `src/domain/entities/`, and `src/domain/expenses/` own cross-surface validation and mutation planning; hooks and agent commands adapt errors, permissions, transactions, archive loading, and activity metrics around them.
- `src/stores/yjs/timerUpdates.ts` applies UI/agent timer edits through shared
  domain interval validation after loading entry history and archived tasks.
  It rechecks the timer before writing so asynchronous loading cannot overwrite
  a concurrent lifecycle change or edit. Note-only updates retain their interval.
- `stores/yjs/workspaceDeletion.ts` connects existing domain impact plans to complete
  loaded history, provider revision readiness, financial preflight and durable
  dependent-before-parent mutations. Task/project/client hooks and agent command
  adapters share it; view-filtered arrays are not a deletion authority.
- Invoice finalization, undo, and terminal cancellation use shared application plans under `src/domain/invoices/` plus the replay-safe `invoiceBillingOperations` journal in `YjsStore`; shared invoice number/task-record helpers keep composer values and compatible duplicate task snapshots canonical before source mutation, and browser/agent adapters do not calculate source release independently.
- The local bridge transports commands but does not become a second data owner.
- The native OpenClaw plugin is a lifecycle/tool adapter around the existing bridge. It starts services only in the full Gateway runtime, does not duplicate TaskTime command/security logic, and leaves generic stdio hosts supported.
- Agent browser credential storage is isolated under `src/agent/browser/`: current-tab bearer resume state uses `sessionStorage`; same-profile reopen uses a dedicated non-Yjs IndexedDB store containing a non-exportable signing key and non-secret routing metadata. Neither participates in provider sync, product backup/export, or entity hooks.
- Public docs and generated tool artifacts derive from the implemented command/catalog sources.

## Change hotspots

| Change | Required areas to inspect |
|---|---|
| Persisted entity/schema | `types.ts`, `validation.ts`, collection hook/store, backup/import, both provider adapters, fixtures, migrations/tests |
| Timer or duration | timer hooks/store, time entries, reports, invoices, agent commands, overlap/rounding tests |
| Invoice or expense | domain operation, billing journal/Yjs collection, active/archive/history ownership, UI, reports, export/PDF/email, backup/restore, agent parity, replay/idempotency tests |
| Route/navigation | `useUrlState.ts`, App rendering, mobile/desktop navigation, service-worker route exclusions, agent navigation |
| Agent command | command registry/handler, scopes/approvals, bridge tool schema, public generated docs, smoke tests |
| Public page/build | Independent `tasktime-site/` checkout; `contracts/site-distribution.md`, `scripts/build-app.mjs`, `scripts/site-contract.mjs`, public routes/redirects, PWA isolation, site-owned browser tests |
| Application origin | `src/config/origins.ts`, Worker exact CORS/OAuth/return configuration, metrics eligibility, PWA/Push scope, agent bridge defaults, supervised reconnect/import runbook, two-origin tests |
| Sync behavior | store dirty-doc tracking, provider/manifest, auth hook, mode UI, offline/reconnect tests, historical Drive data |
| Subscription/entitlement | public plan/status/license contracts, opaque account-reference display, owner-issued complimentary-access lifecycle, exact persisted lifecycle versus online provider-readiness separation, signed offline selection, Portal-return recovery, active-client transition/import-sync compatibility, Reports shell/Free Overview/lazy advanced modules, founding continuity and automatic standard-offer selection, report-agent scope compatibility, hosted-email policy, agent registry/artifacts, Privacy/Terms, offline/concurrency/recovery tests |

## Authoritative references

- Product intent and acceptance: `spec/`
- Stable boundaries and schemas: `contracts/`
- Mandatory constraints: `rules/`
- Current execution state: `status/`
- Exact implementation: source, validation, and tests; discrepancies with specifications must be reconciled rather than silently accepted.
