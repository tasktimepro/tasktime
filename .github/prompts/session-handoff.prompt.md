---
name: session-handoff
description: Prepare a concise TaskTime Pro handoff with completed work, validation, blockers, and exact next steps.
argument-hint: Optional handoff context
agent: agent
---

Handoff context: ${input:context:Optional handoff context}

Read [AGENTS.md](../../AGENTS.md), [status/_status.md](../../status/_status.md), the relevant layer status file, [.agents/skills/session-handoff/SKILL.md](../../.agents/skills/session-handoff/SKILL.md), current diff, and governing specs/contracts/rules/docs.

Capture the active goal, what changed, validation performed, blockers, unresolved decisions, compatibility risks, and the exact next action. Update the relevant status layer. Update specifications, contracts, overview/map, or rules when a durable decision, interface, architecture, or workflow changed. Preserve unrelated `TODO.md` content.

Report any files updated and the next command or prompt a future session should run.
