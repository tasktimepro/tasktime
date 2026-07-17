# TaskTime Pro

[![CI](https://github.com/tasktimepro/tasktime/actions/workflows/ci.yml/badge.svg)](https://github.com/tasktimepro/tasktime/actions/workflows/ci.yml)
[![Agent Bridge](https://img.shields.io/npm/v/%40tasktimepro%2Fagent-bridge?label=agent%20bridge)](https://www.npmjs.com/package/@tasktimepro/agent-bridge)
[![MCP](https://img.shields.io/badge/mcp-pro.tasktime%2Fagent--bridge-0a7cff)](https://tasktime.pro/.well-known/tasktime-agent.json)
[![License](https://img.shields.io/badge/license-AGPL--3.0--only-blue)](./LICENSE)

TaskTime Pro is a free, open-source, local-first work manager for freelancers, covering tasks, timers, expenses, invoices, and reports. Core use requires no TaskTime account or cloud sync, works offline after the PWA is loaded or installed, and stores work records in the browser.

The app stores user work data locally with Yjs and IndexedDB, supports optional Google Drive sync, and exposes an optional first-party same-device MCP bridge for AI agents after explicit pairing. The production app sends limited aggregate usage metrics without project, task, client, invoice, expense, note, or time-entry content.

- Production app: https://tasktime.pro
- Agent docs: https://tasktime.pro/agents/
- Public source: https://github.com/tasktimepro/tasktime

## Highlights

- Projects, clients, hierarchical tasks, project notes, and weekly planning
- Multiple project timers with pause, stop, and automatic time-entry creation
- Expenses, tax-return periods, recurring expenses, and backup/restore flows
- Invoice drafts, terminal cancellation of finalized unpaid invoices, templates, PDF export, payments, quotes, and reports
- Local-first storage with browser persistence and optional Drive-backed sync
- Agent-ready local MCP bridge with scopes, approval tokens, and generated tool docs

## Quick Start

Requirements:

- Docker with Docker Compose
- `make`

All Node/npm commands run through Docker.

```bash
make install
make dev
```

Open http://localhost:3101.

During local development, the public Astro pages are served through the same origin, so these URLs work from the app server:

- http://localhost:3101/blog
- http://localhost:3101/agents
- http://localhost:3101/llms.txt

## Common Commands

```bash
make install                         # install dependencies
make dev                             # start the app on localhost:3101
make stop                            # stop local containers
make lint                            # run ESLint
make typecheck                       # run the repository-wide TypeScript check
make test-run                        # run Vitest once
make test-coverage                   # run Vitest with coverage
make test-e2e-smoke                  # run Playwright smoke tests
make build                           # build the app and public site
make preview                         # build and preview production output
make npm CMD="run build:agent-bridge" # build the agent bridge package
```

## Architecture

- React 19 and Vite for the app
- Tailwind CSS, Radix, and shadcn-style UI primitives
- Yjs CRDT documents with IndexedDB persistence
- Optional Google Drive sync using a private edge OAuth/token service and a policy-selected direct or compatibility-proxy data path
- Astro for the public blog, agent docs, `llms.txt`, and sitemap output
- Vitest for unit/integration tests and Playwright for browser smoke tests

High-level layout:

```text
src/                              App source, hooks, Yjs stores, utilities, tests
agent-bridge/                     Publishable @tasktimepro/agent-bridge package
integrations/openclaw/tasktime/   OpenClaw/ClawHub skill and plugin bundle
integrations/claude/tasktime/      Claude Code plugin bundle and MCP server config
blog/                             Astro public site, blog, and agent docs
public/.well-known/               Agent discovery manifest
e2e/                              Playwright browser tests
test-data/backups/                Public backup fixtures for compatibility tests
```

## AI Agent Access

TaskTime Pro exposes a same-device local MCP bridge through the packaged `tasktime-agent-bridge` binary. The browser app remains the owner of data mutations; the bridge is loopback-only and requires explicit local pairing.

Useful entry points:

- `/agents/` - overview and integration model
- `/agents/quickstart/` - bridge launch, pairing, and first MCP call
- `/agents/security/` - scopes, approvals, revocation, and local-only rules
- `/agents/tools/` - generated MCP tool reference
- `/agents/claude/` - Claude Code plugin installation and safety notes
- `/agents/openclaw/` - OpenClaw/ClawHub installation and publishing notes
- `/agents/mcp-tools.json` - machine-readable tool catalog
- `/agents/skill.md` - Skill-style instructions for agent platforms
- `/llms.txt` and `/.well-known/tasktime-agent.json` - public discovery files
- `integrations/openclaw/tasktime/` - OpenClaw-compatible skill and plugin bundle
- `integrations/claude/tasktime/` - Claude Code plugin bundle

## Data Compatibility

TaskTime Pro is a production local-first app. Browser IndexedDB data, Yjs document shapes, export files, and Drive sync state must be treated as live user data.

When changing persisted data:

- Prefer additive fields and backward-compatible validation.
- Include migrations when existing records need new structure.
- Do not require users to clear browser data or Drive sync state.
- Keep destructive sync, deletion, and billing actions explicit.
- Use the existing Yjs-backed hooks, stores, and command layers instead of adding parallel storage paths.

## Public Repository Boundary

This repository contains the public app, public site, tests, agent bridge, and OpenClaw bundle. Private Cloudflare Worker source, deployment workflows, provider account IDs, production KV/D1 identifiers, secrets, and internal operational runbooks are intentionally managed outside this public source tree.

## Agent Development Workflow

Agent instructions live in `AGENTS.md`. Product intent and acceptance live in `spec/`, durable boundaries in `contracts/`, detailed constraints in `rules/`, and current execution state in `status/`. `SYSTEM_OVERVIEW.md` and `ARCHITECTURE_MAP.md` provide a fast architecture read; `TODO.md` remains the broader backlog and ideas list.

Reusable workflows live in `.agents/skills/`, with editor-invocable ongoing-project prompts in `.github/prompts/`. These files were derived from the established production repository rather than from blank first-intake scaffolding.

The installed agent-kit version is recorded in `KIT_VERSION`, and `KIT_MANIFEST.md` records local ownership. The generic kit source is only update material and does not override TaskTime Pro's production compatibility, architecture, or public/private repository boundaries.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development expectations, compatibility rules, and pull request guidance.

All contributors are expected to follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

For security issues, see [SECURITY.md](./SECURITY.md).

For privacy expectations, see [PRIVACY.md](./PRIVACY.md) and the canonical product policy at https://tasktime.pro/privacy/.

## License

TaskTime Pro app and bridge code are licensed under `AGPL-3.0-only`.

The OpenClaw/ClawHub skill bundle in `integrations/openclaw/tasktime/` is licensed under `MIT-0`.

The Claude Code plugin skill bundle in `integrations/claude/tasktime/` is licensed under `MIT-0`.
