---
name: planning-and-task-breakdown
description: Turn TaskTime Pro goals into small dependency-aware, compatibility-safe, testable vertical slices.
---

# Planning And Task Breakdown

1. Read the request, `AGENTS.md`, `status/`, `SYSTEM_OVERVIEW.md`, `ARCHITECTURE_MAP.md`, relevant `spec/`, `contracts/`, `rules/`, code, tests, and private architecture material when available.
2. Record unresolved product, billing, sync, or migration decisions in `spec/ambiguities.md` rather than inventing them.
3. Define user-visible outcomes and identify persistence, interface, UI, security, migration, and documentation dependencies.
4. Split work into the smallest vertical slices that each produce verifiable behavior and a safe rollback point.
5. For each slice, specify likely areas, tests, Docker commands, acceptance evidence, compatibility risks, and open decisions.
6. Update `spec/roadmap.md` for durable phase changes and the relevant `status/` file for execution state. Update `TODO.md` only when promoting or completing an existing backlog item without overwriting unrelated notes.

Avoid broad scaffolding, speculative abstractions, and slices that cannot be tested independently.
