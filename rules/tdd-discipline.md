# TDD Discipline

Behavior changes use a red/green/refactor cycle.

1. Add or update the smallest test that expresses the intended behavior or regression.
2. Run it through Docker and confirm it fails for the intended reason.
3. Implement the smallest production-compatible change.
4. Re-run the focused test until green.
5. Refactor only while tests remain green.
6. Run the relevant broader suite, lint, build, or browser smoke gate.

Do not weaken assertions, delete regressions, or change test intent merely to make a failure pass. When an existing test fails, compare the test, implementation, production contract, docs, and persisted compatibility requirements before deciding which is stale.

## Test placement and focus

- Follow the repository's existing colocated `*.test.*` pattern and `src/test/integration/` layout.
- Use deterministic fixtures and explicit values rather than randomness.
- Test user-visible behavior and durable contracts, not framework internals.
- Add positive and negative coverage for boundary validation, domain operations, persisted changes, sync, billing, import/export, and agent commands as risk requires.
- Use Playwright smoke tests for complete browser flows and real IndexedDB-backed behavior.

## Coverage and gates

- Preserve the coverage thresholds configured by the project; `src/hooks/**` and `src/utils/**` must meet the per-file threshold stated in `AGENTS.md`.
- Focused work may use `make npm CMD="run test:run -- <path>"`.
- Use `make test-run`, `make test-coverage`, `make test-e2e-smoke`, `make lint`, and `make build` in proportion to risk.
- Broad or release-sensitive changes should pass `make release-gate`.
