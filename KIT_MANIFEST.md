# Installed Agent-Kit Manifest

Installed kit version: `0.2.0`

This file records how the reusable agent-kit is applied to TaskTime Pro. The upstream source manifest governs update comparison; this installed manifest records local ownership.

## Kit-derived, project-customized

- `.github/prompts/*.prompt.md`
- `.agents/skills/*/SKILL.md`, excluding independently managed skills such as `debugbundle`
- `rules/coding-standards.md`
- `rules/design-discipline.md`
- `rules/docker-standards.md`
- `rules/production-hardening.md`
- `rules/tdd-discipline.md`

These files may receive upstream improvements, but updates must preserve TaskTime Pro's production status, existing conventions, Docker commands, and compatibility guarantees.

## Project-owned source of truth

- `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `TODO.md`, and `docs/`
- `SYSTEM_OVERVIEW.md`, `ARCHITECTURE_MAP.md`, `.env.example`, and `status/`
- `spec/`, `contracts/`, `evals/`
- `rules/architectural-constraints.md`, `rules/domain-invariants.md`, and `rules/glossary.md`
- Makefile, Docker/CI/package configuration, application code, tests, fixtures, integrations, and public artifacts

Never overwrite project-owned content from a generic kit template. Merge deliberately and record unresolved conflicts in `spec/ambiguities.md`.
