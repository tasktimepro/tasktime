# Agent Integration Status

## Current focus

- [ ] Validate the installed OpenClaw flow end to end: inspect/create task, start timer, user works, stop the same timer, verify time entry.
- [ ] Verify directory listings and publish the skill/MCP metadata to remaining appropriate registries.
- [ ] Keep bridge package, vendored bundles, generated tool catalogs, public docs, and registry metadata synchronized.
- [x] Add explicit free/no-account/offline/open-source/browser-storage/aggregate-metrics facts and canonical first-party ClawHub source metadata to discovery surfaces without hard-coding the tool count in promotional copy.
- [x] Prepare the metadata release train locally: core app 1.1.1, agent bridge/MCP Registry 0.2.1, ClawHub skill 1.0.9, and OpenClaw/Claude bundles 0.2.2; leave all publication pending approval.
- [x] Confirm the current ClawHub release is clean but unsigned and lacks resolved source provenance; publish 1.0.9 with repository/commit/path provenance and require post-publish provenance verification.
- [x] Route timer/time-entry/task/project/client command behavior through the same domain operations used by the browser UI without removing or renaming commands; add only the optional `stop_timer.idempotencyKey` retry field.
- [x] Align duplicate-create conflicts, expense deletion guards, FX snapshot ordering, and complete-history canonical unbilled queries with browser behavior.
- [x] Clear agent bridge/command TypeScript diagnostics and pass the packaged bridge, bundle, and live MCP release flow.
- [x] Refresh the OpenClaw and Claude vendored bridges from the verified 0.2.0 build and align affected bundle versions at 0.2.0.

## Production baseline

- [x] Browser-owned command context and scoped command registry
- [x] Loopback-only MCP bridge with pairing, sessions, approvals, revocation, and rate limiting
- [x] npm bridge package plus OpenClaw and Claude Code bundles
- [x] Public agent docs, discovery manifests, and generated tool catalog
- [x] Unit, protocol, bundle, smoke, and live-validation paths

Publishing details remain governed by `docs/agent-release-runbook.md`.
