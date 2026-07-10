---
name: debugging-and-error-recovery
description: Reproduce, localize, fix, and guard deterministic failures or unexpected behavior using project Docker commands.
---

# Debugging And Error Recovery

Use for local code, test, build, and deterministic behavior failures. Use the existing DebugBundle skill instead when captured production/runtime incident evidence is relevant.

1. Reproduce with the exact Docker-backed command, state, input, and observed result.
2. Read the failing test or error path, then trace to the smallest relevant module, boundary, or configuration.
3. Reduce the failure to a focused test or command before editing when practical.
4. Compare the expected behavior with `AGENTS.md`, `rules/domain-invariants.md`, docs, comments, and compatibility requirements.
5. Fix production code first when the test expresses the intended contract; change a stale test only with evidence.
6. Add or strengthen a regression test and document any newly discovered non-obvious constraint.
7. Re-run the focused check and the relevant broader gate.

Do not guess at fixes, weaken assertions, expose sensitive diagnostics, or treat destructive data resets as a valid resolution.
