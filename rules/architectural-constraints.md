# Architectural Constraints

## Ownership and layering

- The browser application is the owner of product data and mutations.
- Yjs plus IndexedDB is the only application persistence path. New product state uses existing Yjs hooks/collections rather than direct IndexedDB or ad hoc browser storage.
- Components consume hooks and focused domain/application operations. Shared domain logic must not depend on React rendering.
- A business capability exposed through both the UI and agents must use the same domain/application operation for calculations, validation, mutations, idempotency, and persisted effects. Components and agent commands may translate input/output, permissions, and presentation, but must not maintain competing implementations of the business rule.
- The agent bridge transports scoped business commands; it does not access raw storage or become a second source of truth.
- Provider-specific sync/auth/email behavior stays behind adapters and configuration boundaries.

## Persisted and public contracts

- `src/stores/yjs/types.ts`, `src/stores/yjs/validation.ts`, `contracts/data-schemas.md`, backups, and migrations must stay aligned.
- Historical local, Drive, and backup records remain readable. Add optional fields first and migrate incompatible forms explicitly.
- Routes, document names, sync manifests, agent tool names, package interfaces, generated catalogs, and public URLs are durable contracts.
- Cross-document operations must account for partial failure, replay, idempotency, and orphan recovery.
- A new or changed persisted collection is incomplete until its ownership and document placement, types, validation, historical compatibility or migration, sync/archive behavior, backup/export, import/restore, deletion, reports, UI reads, agent reads/actions, and regression fixtures have all been reviewed and updated where applicable. An intentionally unsupported consumer must be documented rather than silently omitted.

## Cross-surface capability parity

- Every new or changed user-facing business action requires an explicit UI/agent parity review covering command availability, scopes, approvals, input/output schemas, generated catalogs/bundles, error semantics, and tests.
- When a capability is safe for both surfaces, UI and agent behavior must remain functionally equivalent and share the domain operation. If an agent surface is intentionally excluded for security, platform, or interaction reasons, record that decision in the relevant specification or `spec/ambiguities.md` and do not advertise full parity for it.
- Changes to shared business behavior are not complete when only one surface or one generated artifact has been updated.

## Repository boundaries

- The public repository contains the app, public site, tests, local bridge, public integrations, and release metadata.
- Private Worker implementation, deployment state, provider account identifiers, secrets, and internal operations stay in the private infrastructure repository.
- Public code may reference public service endpoints but must not imply that private backend source exists here.

## Runtime and tooling

- React remains functional and hook-based; routing remains the custom path-based `useUrlState` model unless an approved migration preserves URLs and browser navigation.
- Node/npm commands run in Docker through the existing Makefile.
- The development app uses port `3101`; the public Astro development server uses `4321`.
- Dependencies require explicit justification and must not duplicate existing platform or project capabilities.
