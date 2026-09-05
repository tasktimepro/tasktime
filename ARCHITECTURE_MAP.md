# TaskTime Pro Architecture Map

```text
Browser / PWA
├── src/App.jsx + src/components/          UI composition and workflows
├── src/hooks/                             React-facing entity and behavior APIs
├── src/domain/                            Pure/central business operations
│   └── entitlements/                      Implemented shared semantic UI/agent policy (production-disabled)
├── src/config/billingFeatures.ts          Production-off flags + guarded loopback sandbox mode
├── src/config/origins.ts                  Exact marketing/app/migration/Worker/agent origin roles
├── src/contexts/BillingContext.tsx        Normal Worker-backed billing client and lifecycle
├── src/config/localReviewPricing.ts       Shared loopback app + public pricing review values
├── src/stores/yjs/
│   ├── YjsStore.ts                        Store facade and cross-document operations
│   ├── YjsDocManager.ts                   Multi-document lifecycle + IndexedDB
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
        ├── local Stripe/D1 billing + public catalog/signed-license control plane (not deployed)
        ├── DebugBundle endpoint (optional diagnostics)
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

Public web build
└── blog/ + scripts/build-pages.mjs
    ├── dist-app: React HTML/assets, manifest, service worker, SPA fallback
    ├── dist-site: product/pricing/blog/legal/agents, discovery, sitemap, RSS, llms.txt
    └── dist: current combined compatibility surface with app root preserved

Approval-gated Phase 4 production target
├── existing root Pages project → dist-site → tasktime.pro
├── one permanent app Pages project → dist-app → app.tasktime.pro
├── one shared Worker + existing stateful bindings → both origins during overlap
└── pinned dist artifact → root rollback only
```

## Dependency direction

- Components call hooks or focused domain/application functions; they do not create parallel persistence paths.
- Hooks expose Yjs-backed collections and mutations through `YjsContext`/`YjsStore`.
- Domain modules remain UI-independent and receive explicit inputs/dependencies.
- `YjsCloudSyncProvider`, `CloudManifestManager`, and `CloudBackupManager` own the provider-neutral algorithm; `YjsDriveProvider`, `ManifestManager`, `BackupManager`, and Drive-named store/context APIs remain Google compatibility facades. Provider-neutral context/UI APIs expose Dropbox by default; an explicit build-time false value is an emergency UI opt-out, while matching Worker controls remain the fail-closed runtime boundary.
- `YjsContext.disconnectActiveCloudSession(...)` owns the active provider/session/generation lifecycle boundary used by Cloud Sync settings, Account sign-out/deletion, and agent deletion. User-facing flows expose only Disconnect and Wipe data & disconnect; provider-specific revoke and local-session operations remain internal adapters.
- Sync providers operate on Yjs document updates and manifests; they do not redefine entity business rules. Operational recovery keys are scoped by durable provider ID and connection generation, while generation-zero Google mirrors the legacy keys for rolling compatibility.
- The provider owns manifest-write serialization across normal passes and on-demand documents: external lazy loads wait behind an active pass, while callback-owned lazy loads join that pass and leave the final manifest commit to its owner.
- Both provider transports are direct per connection: the selected adapter keeps
  its short-lived token in memory and sends routine file requests only to Google
  Drive or Dropbox API/content origins. The Worker has no provider-data route.
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
- Locally implemented Pro enforcement is action-based through one pure entitlement policy; production switches remain false.
  It gates only transitions that create or restore another active client,
  advanced Reports/exports, and TaskTime-hosted Send—not `/reports`, its current-
  month Overview, visible static tab previews, shared calculations, or underlying
  bookkeeping records. A Reports shell chooses the Free Overview, a locked
  section-specific preview, or a lazy advanced module before protected history or
  report data is collected. Browser and agent adapters share client transition
  and report-scope policy; Worker-cost email rechecks canonical server state and
  quota independently. Only a verified lifecycle-bound assertion authorizes an
  unlimited-client transition or advanced Reports.
- The operator checkout's default `make dev` stack supplies an explicitly
  flagged Vite-development and loopback-only input to `BillingContext`. It keeps
  the normal Worker-backed
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
- Invoice finalization, undo, and terminal cancellation use shared application plans under `src/domain/invoices/` plus the replay-safe `invoiceBillingOperations` journal in `YjsStore`; browser and agent adapters do not calculate source release independently.
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
| Public page/build | `blog/`, `scripts/build-artifacts.mjs`, app/site/combined ownership and collision tests, public manifests, route denylist, preview/build smoke |
| Application origin | `src/config/origins.ts`, Worker exact CORS/OAuth/return configuration, metrics eligibility, PWA/Push scope, agent bridge defaults, supervised reconnect/import runbook, two-origin tests |
| Sync behavior | store dirty-doc tracking, provider/manifest, auth hook, mode UI, offline/reconnect tests, historical Drive data |
| Subscription/entitlement | public plan/status/license contracts, opaque account-reference display, owner-issued complimentary-access lifecycle, exact persisted lifecycle versus online provider-readiness separation, signed offline selection, Portal-return recovery, active-client transition/import-sync compatibility, Reports shell/Free Overview/lazy advanced modules, founding continuity and automatic standard-offer selection, report-agent scope compatibility, hosted-email policy, agent registry/artifacts, Privacy/Terms, offline/concurrency/recovery tests |

## Authoritative references

- Product intent and acceptance: `spec/`
- Stable boundaries and schemas: `contracts/`
- Mandatory constraints: `rules/`
- Current execution state: `status/`
- Exact implementation: source, validation, and tests; discrepancies with specifications must be reconciled rather than silently accepted.
