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
│   └── providers/                         Backup and Google Drive synchronization
├── src/agent/
│   ├── commands/                          Scoped business-command registry
│   ├── browser/                           Browser bridge endpoint and approvals
│   └── transport/                         Browser/bridge protocol
└── src/utils/                              Focused calculations and integrations
        │
        ├── IndexedDB (local, authoritative working copy)
        ├── sync.tasktime.pro OAuth/token broker + compatibility proxy (optional)
        ├── Google Drive appDataFolder direct data path when policy-enabled (optional)
        ├── DebugBundle endpoint (optional diagnostics)
        └── exchange-rate / email / push integrations as configured

Local agent process
└── src/agent/bridge/ → @tasktimepro/agent-bridge
    ├── loopback MCP server
    ├── pairing/session/scope/rate-limit enforcement
    └── WebSocket connection to the browser-owned command layer

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
- Sync providers operate on Yjs document updates and manifests; they do not redefine entity business rules.
- Drive transport is an explicit per-connection dependency: missing/unsupported policy selects the Worker proxy, while policy-enabled direct connections inject the module-owned token provider and keep that choice fixed until reconnect.
- Agent commands call the same store/domain behaviors as the UI and never expose raw Yjs access to MCP clients.
- Shared operations under `src/domain/time/`, `src/domain/tasks/`, `src/domain/work/`, `src/domain/entities/`, and `src/domain/expenses/` own cross-surface validation and mutation planning; hooks and agent commands adapt errors, permissions, transactions, archive loading, and activity metrics around them.
- Invoice finalization, undo, and terminal cancellation use shared application plans under `src/domain/invoices/` plus the replay-safe `invoiceBillingOperations` journal in `YjsStore`; browser and agent adapters do not calculate source release independently.
- The local bridge transports commands but does not become a second data owner.
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
