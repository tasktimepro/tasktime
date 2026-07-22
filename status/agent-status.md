# Agent Integration Status

## Current focus

- [ ] Complete the remaining installed native-plugin write/timer journey: inspect/create task, start timer, later stop the same timer, and verify one time entry. Migration, pairing/read, refresh/reopen, and restart recovery are complete.
- [x] Configure and verify the `CLAWHUB_TOKEN` GitHub Actions secret without exposing its value; dry runs require no secret.
- [ ] Verify directory listings and publish the skill/MCP metadata to remaining appropriate registries.
- [ ] Keep bridge package, vendored bundles, generated tool catalogs, public docs, and registry metadata synchronized.
- [x] Add approval-required, billing-scoped `cancel_invoice` with shared replay-safe behavior, canceled list/report schemas, sanitized failures, and live UI/agent parity coverage.
- [x] Enforce current paid-only eligibility for `mark_invoice_unpaid` and current cancellation eligibility at first commit, returning sanitized conflicts without partial mutation.
- [x] Add explicit free/no-account/offline/open-source/browser-storage/aggregate-metrics facts and canonical first-party ClawHub source metadata to discovery surfaces without hard-coding the tool count in promotional copy.
- [x] Include the cancellation agent surfaces in the locally tagged `v1.2.0` train: agent bridge/MCP Registry `0.3.0`, ClawHub skill `1.1.0`, OpenClaw/Claude bundles `0.3.0`, and Claude marketplace `1.1.0`; leave remote package, registry, marketplace, and directory publication pending separate approval.
- [x] Record the prior ClawHub provenance gap and require repository/commit/path plus post-publish provenance verification for any authorized future release.
- [x] Add a dry-run-first ClawHub release workflow that publishes the explicit `SKILL.md` version from the canonical GitHub commit and verifies server-resolved source provenance; keep real publication approval-gated.
- [x] Migrate the live aligned OpenClaw profile from the legacy MCP owner and shadowing standalone skill to the locally packed native `@tasktimepro/openclaw@1.0.0` candidate with a private recoverable backup, one Gateway-owned bridge, production pairing/read verification, and no plugin diagnostics.
- [x] Validate installed-plugin browser continuity against the current local app: refresh and same-profile close/reopen preserved bridge PID/instance and passed read-only tool calls; verify truthful stale-proof rejection and fresh re-pair after Gateway restart.
- [x] Route timer/time-entry/task/project/client command behavior through the same domain operations used by the browser UI without removing or renaming commands; add only the optional `stop_timer.idempotencyKey` retry field.
- [x] Align duplicate-create conflicts, expense deletion guards, FX snapshot ordering, and complete-history canonical unbilled queries with browser behavior.
- [x] Clear agent bridge/command TypeScript diagnostics and pass the packaged bridge, bundle, and live MCP release flow.
- [x] Refresh the OpenClaw and Claude vendored bridges from the verified `0.3.0` build and align affected bundle versions at `0.3.0`.
- [x] Implement the durability v1 candidate: secret-free lifecycle-managed discovery, same-tab and same-profile browser continuity, Gateway-owned native OpenClaw service, duplicate-owner blocking, explicit validated migration guidance, shutdown cleanup, and synchronized public/source-of-truth docs.
- [x] Pass `make release-gate`, `release:agent`, focused lifecycle/plugin tests, isolated and live OpenClaw install/inspect/doctor, package dry-runs, and aligned `2026.7.1-2` native Gateway migration/rollback checks; keep only the installed native write/timer leg pending.
- [x] Align the shell CLI and Gateway at OpenClaw `2026.7.1-2`, update the drifted official Codex plugin, and verify healthy loopback Gateway connectivity with no plugin diagnostics.
- [x] Prepare but do not publish the coordinated candidate versions: core app `1.4.0`, agent bridge/MCP Registry `1.0.0`, OpenClaw and Claude bundles `1.0.0`, and ClawHub skill/Claude marketplace `1.2.0`.

## Production baseline

- [x] Browser-owned command context and scoped command registry
- [x] Loopback-only MCP bridge with pairing, sessions, approvals, revocation, and rate limiting
- [x] npm bridge package plus OpenClaw and Claude Code bundles
- [x] Public agent docs, discovery manifests, and generated tool catalog
- [x] Unit, protocol, bundle, smoke, and live-validation paths

Publishing details remain governed by `docs/agent-release-runbook.md`.

The implemented durability phase is the agent integration v1 candidate. Do not commit, tag, publish, or deploy it until the remaining installed native write/timer decision is resolved and the user explicitly approves those actions.
