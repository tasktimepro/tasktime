# Agent Integration Status

## Current focus

- [ ] Validate the installed OpenClaw flow end to end: inspect/create task, start timer, user works, stop the same timer, verify time entry.
- [ ] Verify directory listings and publish the skill/MCP metadata to remaining appropriate registries.
- [ ] Keep bridge package, vendored bundles, generated tool catalogs, public docs, and registry metadata synchronized.
- [x] Add approval-required, billing-scoped `cancel_invoice` with shared replay-safe behavior, canceled list/report schemas, sanitized failures, and live UI/agent parity coverage.
- [x] Enforce current paid-only eligibility for `mark_invoice_unpaid` and current cancellation eligibility at first commit, returning sanitized conflicts without partial mutation.
- [x] Add explicit free/no-account/offline/open-source/browser-storage/aggregate-metrics facts and canonical first-party ClawHub source metadata to discovery surfaces without hard-coding the tool count in promotional copy.
- [x] Prepare the cancellation release train locally: core app `1.2.0`, agent bridge/MCP Registry `0.3.0`, ClawHub skill `1.1.0`, OpenClaw/Claude bundles `0.3.0`, and Claude marketplace `1.1.0`; leave all publication pending approval.
- [x] Record the prior ClawHub provenance gap and require repository/commit/path plus post-publish provenance verification for any authorized future release.
- [x] Route timer/time-entry/task/project/client command behavior through the same domain operations used by the browser UI without removing or renaming commands; add only the optional `stop_timer.idempotencyKey` retry field.
- [x] Align duplicate-create conflicts, expense deletion guards, FX snapshot ordering, and complete-history canonical unbilled queries with browser behavior.
- [x] Clear agent bridge/command TypeScript diagnostics and pass the packaged bridge, bundle, and live MCP release flow.
- [x] Refresh the OpenClaw and Claude vendored bridges from the verified `0.3.0` build and align affected bundle versions at `0.3.0`.

## Production baseline

- [x] Browser-owned command context and scoped command registry
- [x] Loopback-only MCP bridge with pairing, sessions, approvals, revocation, and rate limiting
- [x] npm bridge package plus OpenClaw and Claude Code bundles
- [x] Public agent docs, discovery manifests, and generated tool catalog
- [x] Unit, protocol, bundle, smoke, and live-validation paths

Publishing details remain governed by `docs/agent-release-runbook.md`.
