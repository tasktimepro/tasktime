---
name: review-phase
description: Review a TaskTime Pro work item or release slice for completeness, production risk, tests, and documentation drift.
argument-hint: Work item, release slice, or latest completed change
agent: agent
---

Review scope: ${input:scope:Work item, release slice, or latest completed change}

Read and follow:

- [AGENTS.md](../../AGENTS.md)
- [status/_status.md](../../status/_status.md)
- [SYSTEM_OVERVIEW.md](../../SYSTEM_OVERVIEW.md) and [ARCHITECTURE_MAP.md](../../ARCHITECTURE_MAP.md)
- [spec/requirements.md](../../spec/requirements.md) and [spec/acceptance.md](../../spec/acceptance.md)
- [rules/domain-invariants.md](../../rules/domain-invariants.md)
- [rules/tdd-discipline.md](../../rules/tdd-discipline.md)
- [.agents/skills/phase-review/SKILL.md](../../.agents/skills/phase-review/SKILL.md)
- [.agents/skills/pre-ship-review/SKILL.md](../../.agents/skills/pre-ship-review/SKILL.md)
- [.agents/skills/post-phase-reconciliation/SKILL.md](../../.agents/skills/post-phase-reconciliation/SKILL.md)

Gather the request, status/roadmap item, relevant specs, contracts, docs, rules, implementation, validation, tests, comments, and generated public artifacts. Reconstruct the promised scope and compare it with current behavior, including historical persisted data, sync/reconnect, security boundaries, partial failure, cleanup, and negative paths where relevant.

Use a review mindset: findings first and ordered by severity, with concrete file references. Then cover scope, complete items, gaps, drift, pre-ship risks, test coverage, reconciliation needed, and readiness. Do not make fixes or update tracking unless the user explicitly asks for reconciliation.
