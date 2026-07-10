# Coding Standards

These rules extend `AGENTS.md`; if they disagree, `AGENTS.md` wins.

## Clarity and scope

- Prefer explicit, readable control flow and the project's existing patterns.
- Keep changes focused. Do not add abstractions without an in-scope consumer.
- Use functional React components, Yjs-backed hooks for application data, Tailwind for styling, and the existing naming conventions in `AGENTS.md`.
- Preserve stable imports and public interfaces when splitting large modules.
- Do not add dependencies until existing code and platform APIs have been ruled out.

## Comments and documentation

- Read existing behavior comments before editing related code.
- Comments explain intent, invariants, compatibility constraints, and surprising edge cases—not syntax.
- Update or remove stale comments in the same change as behavior.
- Update public docs, contracts, examples, and generated agent documentation when their interface changes.

## Boundaries and errors

- Validate untrusted browser, import, sync, bridge, and third-party data at its boundary.
- Keep provider-specific behavior in adapters and use the established domain and command layers.
- Do not swallow errors. External errors must be safe; internal diagnostics must not expose secrets or sensitive user data.
- Configuration and secrets must remain environment-driven. Never commit private worker implementation or operational credentials.

## Compatibility

- TaskTime Pro is in production. Persisted Yjs shapes, IndexedDB data, backups, Drive state, routes, agent commands, and public artifacts are durable contracts.
- Prefer additive changes and tolerant readers. Use explicit migrations for incompatible persisted changes.
- Remove legacy code only after the compatible replacement and migration path are verified.

## Completion

- Follow `rules/tdd-discipline.md` for behavior changes.
- Run commands through Docker-backed Make targets.
- Review changed code for tests, comment accuracy, documentation impact, security, and cleanup before declaring it complete.
