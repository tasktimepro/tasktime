# Contributing

Thanks for helping improve TaskTime Pro.

TaskTime Pro is a production local-first app. Changes must preserve existing browser IndexedDB/Yjs data and Google Drive sync compatibility.

## Development

All Node/npm commands run through Docker:

```bash
make install
make dev
make lint
make build
make npm CMD="run test:run"
```

Do not run `npm` directly on the host.

## Data Compatibility

- Keep schema changes additive unless a migration is included.
- Do not require users to clear browser data or Drive sync state.
- Do not add direct IndexedDB writes for new features; use the existing Yjs-backed hooks and command layers.
- Keep destructive sync and billing actions explicit and reversible where practical.

## Agent Bridge

The local agent bridge is same-device only. Preserve these boundaries:

- The browser app remains the mutation owner.
- The bridge must stay loopback-only.
- Sensitive actions require TaskTime Pro approval semantics.
- MCP tools should expose business actions, not raw storage access.

## Public Repository Boundary

The public source tree excludes private Cloudflare Worker source and deployment configuration. Do not add secrets, provider account IDs, production KV/D1 identifiers, private worker code, or operational runbooks to the public repo.

## License

TaskTime Pro app and bridge code are licensed under `AGPL-3.0-only`. OpenClaw/ClawHub skill artifacts are licensed under `MIT-0` to match ClawHub publishing expectations.
