# Agent Integration Status

## Current focus

- [ ] Validate the installed OpenClaw flow end to end: inspect/create task, start timer, user works, stop the same timer, verify time entry.
- [ ] Verify directory listings and publish the skill/MCP metadata to remaining appropriate registries.
- [ ] Keep bridge package, vendored bundles, generated tool catalogs, public docs, and registry metadata synchronized.

## Production baseline

- [x] Browser-owned command context and scoped command registry
- [x] Loopback-only MCP bridge with pairing, sessions, approvals, revocation, and rate limiting
- [x] npm bridge package plus OpenClaw and Claude Code bundles
- [x] Public agent docs, discovery manifests, and generated tool catalog
- [x] Unit, protocol, bundle, smoke, and live-validation paths

Publishing details remain governed by `docs/agent-release-runbook.md`.
