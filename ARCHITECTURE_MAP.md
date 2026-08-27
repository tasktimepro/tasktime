# TaskTime Pro Architecture Map

```text
Browser / PWA
├── src/App.jsx + src/components/          UI composition and workflows
├── src/hooks/                             React-facing entity and behavior APIs
├── src/domain/                            Pure/central business operations
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
        ├── Dropbox App Folder direct data path (implemented locally, disabled)
        ├── provider-neutral hosted identity (implemented privately; production migration/deployment pending)
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
    ├── blog and legal pages
    ├── /agents documentation and generated tool catalogs
    └── discovery manifests, sitemap, RSS, and llms.txt
```

## Dependency direction

- Components call hooks or focused domain/application functions; they do not create parallel persistence paths.
- Hooks expose Yjs-backed collections and mutations through `YjsContext`/`YjsStore`.
- Domain modules remain UI-independent and receive explicit inputs/dependencies.
- `YjsCloudSyncProvider`, `CloudManifestManager`, and `CloudBackupManager` own the provider-neutral algorithm; `YjsDriveProvider`, `ManifestManager`, `BackupManager`, and Drive-named store/context APIs remain Google compatibility facades. Provider-neutral context/UI APIs expose Dropbox by default; an explicit build-time false value is an emergency UI opt-out, while matching Worker controls remain the fail-closed runtime boundary.
- `YjsContext.disconnectActiveCloudSession(...)` owns the active provider/session/generation lifecycle boundary used by Cloud Sync settings, Account sign-out/deletion, and agent deletion. User-facing flows expose only Disconnect and Wipe data & disconnect; provider-specific revoke and local-session operations remain internal adapters.
- Sync providers operate on Yjs document updates and manifests; they do not redefine entity business rules. Operational recovery keys are scoped by durable provider ID and connection generation, while generation-zero Google mirrors the legacy keys for rolling compatibility.
- The provider owns manifest-write serialization across normal passes and on-demand documents: external lazy loads wait behind an active pass, while callback-owned lazy loads join that pass and leave the final manifest commit to its owner.
- Drive transport is direct per connection: the module-owned token provider keeps its short-lived token in memory and routine file requests go straight to Google Drive.
- Dropbox transport is also direct in the disabled implementation: its module-owned token provider keeps short-lived access in memory and its App Folder adapter targets only Dropbox API/content origins. The Worker has no provider-data route.
- The lifecycle-selected provider session is also the hosted-service session.
  Private Worker code derives provider-separated subjects, resolves an opaque
  hosted principal, and links source/target identities only inside verified
  transfer. Legacy `driveSessionId` remains a compatibility field, not a hidden
  Google requirement when Dropbox is active.
- Agent commands call the same store/domain behaviors as the UI and never expose raw Yjs access to MCP clients.
- Shared operations under `src/domain/time/`, `src/domain/tasks/`, `src/domain/work/`, `src/domain/entities/`, and `src/domain/expenses/` own cross-surface validation and mutation planning; hooks and agent commands adapt errors, permissions, transactions, archive loading, and activity metrics around them.
- Invoice finalization, undo, and terminal cancellation use shared application plans under `src/domain/invoices/` plus the replay-safe `invoiceBillingOperations` journal in `YjsStore`; browser and agent adapters do not calculate source release independently.
- The local bridge transports commands but does not become a second data owner.
- The native OpenClaw plugin is a lifecycle/tool adapter around the existing bridge. It starts services only in the full Gateway runtime, does not duplicate TaskTime command/security logic, and leaves generic stdio hosts supported.
- Agent browser credential storage is isolated under `src/agent/browser/`: current-tab bearer resume state uses `sessionStorage`; same-profile reopen uses a dedicated non-Yjs IndexedDB store containing a non-exportable signing key and non-secret routing metadata. Neither participates in Drive sync, product backup/export, or entity hooks.
- Public docs and generated tool artifacts derive from the implemented command/catalog sources.

## Change hotspots

| Change | Required areas to inspect |
|---|---|
| Persisted entity/schema | `types.ts`, `validation.ts`, collection hook/store, backup/import, Drive sync, fixtures, migrations/tests |
| Timer or duration | timer hooks/store, time entries, reports, invoices, agent commands, overlap/rounding tests |
| Invoice or expense | domain operation, billing journal/Yjs collection, active/archive/history ownership, UI, reports, export/PDF/email, backup/restore, agent parity, replay/idempotency tests |
| Route/navigation | `useUrlState.ts`, App rendering, mobile/desktop navigation, service-worker route exclusions, agent navigation |
| Agent command | command registry/handler, scopes/approvals, bridge tool schema, public generated docs, smoke tests |
| Public page/build | `blog/`, build scripts, public manifests, route denylist, preview/build smoke |
| Sync behavior | store dirty-doc tracking, provider/manifest, auth hook, mode UI, offline/reconnect tests, historical Drive data |

## Authoritative references

- Product intent and acceptance: `spec/`
- Stable boundaries and schemas: `contracts/`
- Mandatory constraints: `rules/`
- Current execution state: `status/`
- Exact implementation: source, validation, and tests; discrepancies with specifications must be reconciled rather than silently accepted.
