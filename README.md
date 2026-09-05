# TaskTime Pro

[![CI](https://github.com/tasktimepro/tasktime/actions/workflows/ci.yml/badge.svg)](https://github.com/tasktimepro/tasktime/actions/workflows/ci.yml)
[![Agent Bridge](https://img.shields.io/npm/v/%40tasktimepro%2Fagent-bridge?label=agent%20bridge)](https://www.npmjs.com/package/@tasktimepro/agent-bridge)
[![MCP](https://img.shields.io/badge/mcp-pro.tasktime%2Fagent--bridge-0a7cff)](https://tasktime.pro/.well-known/tasktime-agent.json)
[![License](https://img.shields.io/badge/license-AGPL--3.0--only-blue)](./LICENSE)

TaskTime Pro is a free, open-source, local-first work manager for freelancers, covering tasks, timers, expenses, invoices, and reports. Core use requires no TaskTime account or cloud sync, works offline after the PWA is loaded or installed, and stores work records in the browser.

The app stores user work data locally with Yjs and IndexedDB, supports optional Google Drive or Dropbox sync, and exposes an optional first-party same-device MCP bridge for AI agents after explicit pairing. The production app sends limited aggregate usage metrics without project, task, client, invoice, expense, note, or time-entry content.

- Production app: https://tasktime.pro
- Agent docs: https://tasktime.pro/agents/
- Public source: https://github.com/tasktimepro/tasktime

## Highlights

- Projects, clients, hierarchical tasks, project notes, and weekly planning
- Multiple project timers with pause, stop, and automatic time-entry creation
- Expenses, tax-return periods, recurring expenses, and backup/restore flows
- Invoice drafts, terminal cancellation of finalized unpaid invoices, templates, PDF export, payments, quotes, and reports
- Local-first storage with browser persistence and optional provider-backed sync
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
- http://localhost:3101/product
- http://localhost:3101/pricing
- http://localhost:3101/agents
- http://localhost:3101/llms.txt

## Common Commands

```bash
make install                         # install dependencies
make dev                             # start the complete production-like local stack
make dev-core                        # start only the public core app for isolated diagnostics
make dev-billing-sandbox             # explicit alias for the complete local stack
make stop                            # stop local containers
make lint                            # run ESLint
make typecheck                       # run the repository-wide TypeScript check
make test-run                        # run Vitest once
make test-coverage                   # run Vitest with coverage
make test-e2e-smoke                  # run Playwright smoke tests in Chromium
make test-e2e-drive-browsers         # run direct Drive smoke in Chromium, Firefox, and WebKit
make build                           # build isolated app/site plus combined compatibility outputs
make preview                         # build and preview production output
make npm CMD="run build:agent-bridge" # build the agent bridge package
```

In an operator checkout containing `tasktime-infra`, `make dev` is the default
production-like development workflow. It replaces the retired synthetic billing-
state preview, points the Vite app at the local Worker, and exercises the normal
catalog, account, trial, Checkout, webhook, reconciliation, license, Portal,
hosted Send, Google Drive, Dropbox, and enabled Worker-service paths against
local state and Stripe test mode. `make dev-billing-sandbox` remains a compatible
explicit alias. A public checkout without the private infrastructure repository
falls back to the core app; `make dev-core` selects that path explicitly.

`make build` produces `dist-app` for the React PWA/SPA, `dist-site` for Astro
public pages and discovery, and `dist` as the unchanged combined compatibility
surface used by current release automation. The split outputs are local release
inputs only until the app-subdomain cutover is separately approved.

Product screens remain visually production-like, without sandbox-only banners or
developer-facing notices. Hosted Send and delivery-status requests use the normal
Pro entitlement, quota, recovery, and configured Resend account. Startup requires
`RESEND_API_KEY` in the ignored Worker `.dev.vars`, so a missing delivery provider
fails clearly before the stack opens instead of producing a later 503. Send only
to a test address you control. Production builds ignore the sandbox flag, and the
tracked production Worker controls remain unchanged and off. Any Worker control
enabled in tracked production configuration must not be disabled by the local
overlay; a contract test enforces that one-way parity.

Start the complete local stack from the repository root. The command
prepares local D1/configuration and starts the app, Worker, scheduled recovery
runner, and Dockerized Stripe webhook listener together. Their logs remain attached, and `Ctrl+C`
stops and removes the complete stack. The long-running services use a dedicated
Compose project, so ordinary one-off validation commands cannot stop them:

```bash
make dev
```

Preparation accepts a current `STRIPE_SECRET_KEY=sk_test_...` or the authenticated
Stripe CLI profiles. When several accounts are configured, it safely selects the
test credential that can read TaskTime's exact configured Price instead of
assuming `[default]`. It writes only ignored mode-`0600` local files,
applies the private service's checked-in migrations to isolated local state, and
seeds local-only rollout approvals. It then read-only attests the applied email ledger against
the canonical tables, constraints, indexes, and triggers. Schema drift stops
startup without repairing or deleting local data. If the CLI temporary key
expired, run `stripe login` or pass
a current test secret key and rerun the same command. Stripe authentication and
the ignored local service credentials are the only host prerequisites. A
previously prepared valid local test key is reused, and the recurring validation
plus runtime services use the
pinned official Stripe CLI Docker image. The listener receives only its API key,
not the Worker signing or HMAC configuration, and its attached output masks the
local webhook signing secret. The Worker waits for signing material emitted by
that same attached listener session, preventing a separate temporary listener
from leaving webhook verification out of sync. The lower-level private Worker
commands remain available for diagnosing an individual service. Use only Stripe
test cards and fictional customer details; never enter a real card or identity.

The public comparison remains available from the same server at
`http://localhost:3101/pricing/`. Ordinary loopback development can use the same
bundled review prices while the live Worker catalog is unavailable. The billing
sandbox deliberately disables that fallback so local Worker/configuration failures
remain visible before any trial or test purchase.

The Vite server intentionally does not install the production service worker, so
installability, offline-cache updates, and Web Push still require the existing
production-preview/PWA smoke workflow. That is a browser-runtime limitation, not
a disabled product feature in the local Worker stack.

## Architecture

- React 19 and Vite for the app
- Tailwind CSS, Radix, and shadcn-style UI primitives
- Yjs CRDT documents with IndexedDB persistence
- Optional Google Drive or Dropbox sync sends routine sync files directly from your browser to your own selected provider; the private edge service handles OAuth, short-lived token issuance, revocation, and provider-neutral hosted identity
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
- `/product/` - static product overview and direct app entry point
- `/pricing/` - Free and Pro comparison, including the founding and standard annual offers
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

TaskTime Pro is a production local-first app. Browser IndexedDB data, Yjs document shapes, export files, and cloud sync state must be treated as live user data.

When changing persisted data:

- Prefer additive fields and backward-compatible validation.
- Include migrations when existing records need new structure.
- Do not require users to clear browser data or cloud sync state.
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
