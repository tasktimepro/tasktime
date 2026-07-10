# Architectural Constraints

## Ownership and layering

- The browser application is the owner of product data and mutations.
- Yjs plus IndexedDB is the only application persistence path. New product state uses existing Yjs hooks/collections rather than direct IndexedDB or ad hoc browser storage.
- Components consume hooks and focused domain/application operations. Shared domain logic must not depend on React rendering.
- The agent bridge transports scoped business commands; it does not access raw storage or become a second source of truth.
- Provider-specific sync/auth/email behavior stays behind adapters and configuration boundaries.

## Persisted and public contracts

- `src/stores/yjs/types.ts`, `src/stores/yjs/validation.ts`, `contracts/data-schemas.md`, backups, and migrations must stay aligned.
- Historical local, Drive, and backup records remain readable. Add optional fields first and migrate incompatible forms explicitly.
- Routes, document names, sync manifests, agent tool names, package interfaces, generated catalogs, and public URLs are durable contracts.
- Cross-document operations must account for partial failure, replay, idempotency, and orphan recovery.

## Repository boundaries

- The public repository contains the app, public site, tests, local bridge, public integrations, and release metadata.
- Private Worker implementation, deployment state, provider account identifiers, secrets, and internal operations stay in the private infrastructure repository.
- Public code may reference public service endpoints but must not imply that private backend source exists here.

## Runtime and tooling

- React remains functional and hook-based; routing remains the custom path-based `useUrlState` model unless an approved migration preserves URLs and browser navigation.
- Node/npm commands run in Docker through the existing Makefile.
- The development app uses port `3101`; the public Astro development server uses `4321`.
- Dependencies require explicit justification and must not duplicate existing platform or project capabilities.
