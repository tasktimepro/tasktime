---
name: resume-phase
description: Resume the next TaskTime Pro work item from current project evidence with tests and production compatibility first.
argument-hint: Optional TODO item, slice, or constraint
agent: agent
---

Resume target: ${input:target:Optional TODO item, slice, or constraint}

Resume project work from the current tracked state. Before editing, read:

- [AGENTS.md](../../AGENTS.md)
- [status/_status.md](../../status/_status.md) and the relevant layer status file
- [SYSTEM_OVERVIEW.md](../../SYSTEM_OVERVIEW.md) and [ARCHITECTURE_MAP.md](../../ARCHITECTURE_MAP.md)
- [spec/requirements.md](../../spec/requirements.md), [spec/acceptance.md](../../spec/acceptance.md), and relevant feature/design specs
- relevant files under [contracts/](../../contracts/) and [rules/](../../rules/)
- [TODO.md](../../TODO.md) when the selected work comes from the broader backlog
- relevant files under [rules/](../../rules/)
- relevant project and operational documentation
- existing tests and behavior comments beside code likely to change
- [.agents/skills/planning-and-task-breakdown/SKILL.md](../../.agents/skills/planning-and-task-breakdown/SKILL.md) when decomposition is needed

Identify the selected work item and reconcile any supplied target with `status/`, relevant specifications, `TODO.md` when applicable, and current code. State assumptions where tracking is stale or ambiguous. Follow red/green discipline for behavior changes, preserve existing local and synced data, use Docker-backed commands, and keep the slice minimal and reviewable.

Report the selected scope, changed files, validation performed, blockers, and the next useful action. Update the relevant status and context documents when their tracked state or governed behavior changed. Do not invent missing product decisions.
