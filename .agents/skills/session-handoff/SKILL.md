---
name: session-handoff
description: Leave a concise, accurate continuation point without creating duplicate project status files.
---

# Session Handoff

1. Summarize the active goal, completed work, changed files, validation run, and exact remaining step.
2. Record blockers, unresolved decisions, compatibility concerns, and commands that could not be run.
3. Update `status/_status.md` and the relevant layer status with useful continuation state.
4. Put durable architecture, domain, interface, or workflow decisions in the appropriate `spec/`, `contracts/`, `rules/`, overview/map, or documentation file.
5. Update `TODO.md` only when the active work directly changes an existing backlog item; preserve unrelated notes.

The next agent should be able to continue without rediscovery or guessing.
