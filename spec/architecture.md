# Architecture Specification

## Architectural style

TaskTime Pro is a browser-owned local-first system with optional remote and local-process adapters. Yjs is the conflict-resolution and persistence model; React hooks are the application-facing state API; focused domain modules centralize cross-surface business operations.

## Layers

| Layer | Responsibilities |
|---|---|
| UI | Screens, components, responsive layout, interaction state, modals, and navigation |
| Hooks/context | React subscriptions and mutation APIs over Yjs store/domain operations |
| Domain/application | Deterministic deletion, billing, expense, settings, and other reusable business behavior |
| Yjs store | Collection ownership, cross-document operations, archival, timers, validation, and persistence lifecycle |
| Providers/adapters | Drive/manifest, backup, auth, email, push, PDF, diagnostics, and exchange-rate boundaries |
| Agent commands | Scoped business-action facade used by browser bridge/MCP tooling |
| Local bridge | Pairing, sessions, origins, scopes, approvals, rate limiting, command transport, and MCP protocol |
| Managed agent plugin | Host-lifecycle ownership and generated tool adaptation around the existing local bridge; no product-data or business-logic ownership |
| Public build | Astro content, generated agent artifacts, discovery files, and combined production output |

## Data distribution

The current document contract includes `core`, `entries-active`, `entries-{year}`, `tasks-archived`, `expenses-archived`, and `invoices-archived`. Document names are stable. Collections and current entity shapes are summarized in `contracts/data-schemas.md`; exact validation is implemented in `src/stores/yjs/validation.ts`.

## Consistency boundaries

- Yjs resolves concurrent document updates, but business invariants spanning documents still require explicit application operations and recovery tests.
- Invoice finalization/undo, cascade deletion, timer stop, archival, and import/restore are multi-entity transitions and must be idempotent or safely recoverable.
- Old remote state may reappear after local migration, so validation and compatibility cannot exist only at initial load.

## Navigation and public routing

The app uses `useUrlState` and History API events rather than React Router. App routes and query parameters are specified in `spec/routes.md`. Vite/PWA navigation exclusions protect Astro/static routes from SPA fallback.

## External boundaries

- Google OAuth, token-control, and push endpoints use the configured Worker URL. Routine Google Drive file requests go directly from the browser to Google Drive with a short-lived, memory-only access token.
- The private Worker's source and deployment are external to this repository.
- Email, exchange rates, DebugBundle, npm/MCP registries, and agent platforms are adapters with sanitized failure behavior.
- The local agent bridge binds to loopback, while the browser remains the mutation owner.
- The official OpenClaw plugin runs in the supervised Gateway, owns one packaged bridge child for that Gateway/profile lifetime, and routes generated native tools through the existing bridge enforcement. Generic MCP and Claude integrations continue to own their stdio bridge processes directly.
- Browser refresh retains a bounded app-session bearer token only in current-tab `sessionStorage`. Same-profile close/reopen continuity uses a dedicated origin-local IndexedDB credential store containing a non-exportable P-256 signing key and non-secret discovery metadata; it is isolated from Yjs, Drive, backup/export, and product state. The live bridge stores only the matching public-key authorization in memory, so Gateway restart remains an explicit re-pair boundary.

## Evolution rules

Architecture changes must update `SYSTEM_OVERVIEW.md`, `ARCHITECTURE_MAP.md`, relevant contracts/rules, public docs, comments, tests, and status in the same slice. Production migrations precede removal of historical compatibility code.

New persisted data follows the complete consumer review in `rules/production-hardening.md` and requirement `DATA-6`. New or changed user-facing business actions follow the cross-surface parity rules in `rules/architectural-constraints.md` and requirement `AGENT-4`. Shared domain/application operations remain the authoritative behavior; UI and agent layers are adapters, not independent implementations.
