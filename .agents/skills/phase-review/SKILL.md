---
name: phase-review
description: Cross-check a completed work item or release slice against its intended behavior, docs, contracts, and tests.
---

# Phase Review

Review the scope the user names or infer it from `spec/roadmap.md`, `status/`, and the diff, then state that assumption.

1. Reconstruct every promised behavior, interface, artifact, migration, and acceptance expectation from the request, specs, contracts, roadmap/status, docs, comments, and tests.
2. Map each item to its implementation and verify edge cases, not only the happy path.
3. Compare storage, sync, agent, and public interfaces with types, validation, generated docs, and supported legacy forms.
4. Confirm tests would fail if the behavior disappeared and that risk-appropriate negative paths exist.
5. Report findings first, ordered by severity, with concrete file references.
6. Separate complete items, gaps, drift, test coverage, reconciliation needs, and readiness.

Review is read-only unless the user explicitly asks to fix or reconcile findings.
