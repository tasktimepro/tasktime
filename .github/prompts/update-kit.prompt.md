---
name: update-kit
description: Update this established production project from a newer agent-kit while preserving project-owned rules, docs, code, tests, and tracking.
argument-hint: Optional kit source path or update goal
agent: agent
---

Update source or goal: ${input:target:Optional kit source path or update goal}

Use `agent-kit/` as the default source when present. Before editing, read its `VERSION`, `KIT_MANIFEST.md`, `AGENTS.md`, `start.md`, `README.md`, `rules/*`, `skills/*/SKILL.md`, and `.github/prompts/*.prompt.md`. Then inspect the target's `KIT_VERSION`, `AGENTS.md`, `.github/prompts/`, `rules/`, `.agents/skills/`, `README.md`, `TODO.md`, docs, Makefile, Docker files, package scripts, tests, and CI.

Classify the current installation, prepare a file-by-file plan, and preserve TaskTime Pro's production compatibility and project-specific customizations. Do not copy first-intake/checklist/verification workflows, generic status templates, blank spec/contract/eval scaffolding, or the generic Makefile unless the project has deliberately adopted those structures. Merge universal improvements into the project-aware files and flag unresolved conflicts instead of guessing.

After editing, validate prompt frontmatter, skill names, local references, ownership boundaries, and executable changes when any. Update `KIT_VERSION` only after the update succeeds. Report the previous state, target version, added/updated/preserved files, conflicts, omissions, and validation.
