# Contributing

Thanks for helping improve TaskTime Pro.

TaskTime Pro is a production local-first app. Contributions should keep the app reliable for existing users and easy for new developers to understand.

## Before You Start

- Keep changes focused and easy to review.
- Prefer existing patterns in `src/hooks/`, `src/stores/yjs/`, `src/agent/`, and the UI components.
- Do not add new dependencies unless the benefit is clear.
- Do not commit secrets, provider account IDs, private worker code, deployment workflows, or internal runbooks.
- Report security issues through the process in [SECURITY.md](./SECURITY.md), not public issues.
- Follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) in issues, pull requests, discussions, package listings, and other project spaces.
- Follow [PRIVACY.md](./PRIVACY.md) when sharing logs, screenshots, examples, agent outputs, or bug reports.

## Development

All Node/npm commands run through Docker.

```bash
make install
make dev
make lint
make test-run
make build
```

Use `make npm CMD="<command>"` for arbitrary npm commands. Do not run `npm` directly on the host.

## Pull Requests

Good pull requests usually include:

- A clear description of the user-facing or developer-facing change
- Tests for behavior changes, especially persisted data, sync, invoices, expenses, timers, reports, and agent commands
- Notes about compatibility or migration impact when stored data is involved
- Updated public docs when commands, packages, agent tools, or workflows change

Before requesting review, run the smallest useful verification set. For broad changes, run:

```bash
make lint
make test-run
make build
```

Use Playwright smoke tests for browser flows:

```bash
make test-e2e-smoke
```

## Data Compatibility

Existing browser IndexedDB data, Yjs document shapes, export files, and Drive sync state are live user data.

- Keep schema changes additive when possible.
- Include explicit migrations for incompatible changes.
- Preserve old entity shapes in validation and import paths.
- Do not require users to clear browser data or Drive sync state.
- Keep destructive sync, deletion, and billing actions explicit and reversible where practical.
- Use existing Yjs hooks, stores, and command layers instead of adding parallel persistence.

## Agent Bridge

The TaskTime Pro agent bridge is same-device only.

- The browser app remains the mutation owner.
- The bridge must stay loopback-only.
- Pairing, scopes, approval tokens, and revocation behavior must remain explicit.
- MCP tools should expose business actions, not raw storage access.
- Generated tool docs and public agent docs should stay in sync with tool changes.

## Public Repository Boundary

This repository intentionally excludes private Cloudflare Worker source, deployment configuration, secrets, provider account IDs, production KV/D1 identifiers, and internal operational runbooks.

Public code may reference public endpoints such as `https://sync.tasktime.pro`, but private implementation details belong outside this repo.

## License

TaskTime Pro app and bridge code are licensed under `AGPL-3.0-only`.

The OpenClaw/ClawHub skill bundle in `integrations/openclaw/tasktime/` is licensed under `MIT-0`.
