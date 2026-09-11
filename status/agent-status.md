# Agent Integration Status

## Current focus

- Core dependency remediation (2026-09-11, local/uncommitted) passes canonical
  bridge/native OpenClaw builds, bridge and managed-bundle smokes, and the
  isolated live browser/MCP timer/invoice/cancellation journey. Public tool,
  discovery and version contracts are unchanged, and site snapshot parity
  passes. The generated bridge still matches the existing OpenClaw vendor;
  this dependency-only slice adds no agent publication beyond the broader
  checkpoint train below. Its pre-existing Claude vendor refresh remains a
  Phase 4 release-preparation step. No installed agent or published package was
  changed. Core evidence is in `app-status.md`.

- Public documentation distribution moved to independent `tasktime-site/`
  (2026-09-11, uncommitted). Core retains all runtime/package sources and the
  discovery manifest at `agent-bridge/discovery/tasktime-agent.json`; site pins
  the generated public contract and owns domain-proof hosting. Tool catalog,
  skill output, discovery and registry proof match the pre-extraction bytes.
  This move alone requires no agent republish; the broader checkpoint release
  assessment below still applies. See `contracts/site-distribution.md` and the
  updated public-docs/key-rotation sections of `docs/agent-release-runbook.md`.

- Local checkpoint release assessment (2026-09-11): the pending recurrence and
  expense-category work changes bridge tool schemas/descriptions and generated
  OpenClaw artifacts, so the broader checkpoint is not core-only. A future
  approved release must include bridge/MCP Registry and OpenClaw updates, refresh
  the Claude vendored bridge from the same canonical build, and include that
  changed Claude bundle. The current OpenClaw vendor matches the local bridge
  build; the Claude vendor is still the preceding version. The unchanged ClawHub
  skill needs no additional publication solely for this checkpoint. Keep the
  existing unpublished candidate versions until release preparation; no artifact
  is published here. Dated `uncommitted` entries below describe their earlier
  validation state and are included in this local checkpoint.

- [x] Harden queued active-client entitlement checks (2026-09-10, uncommitted).
  Browser-owned command contexts retain live plan reads through app-session
  scope adaptation, and the client application lock rechecks plan as well as
  count before commit. Regressions cover a pending Pro command becoming
  unresolved before lock acquisition and the universally Free first-client
  slot. Public command/wire schemas and published agent artifacts are unchanged;
  this is browser/core-app implementation only. See `app-status.md` for audit gates.
- [x] Add the local subscription policy surface to the command registry:
  argument-aware Free `get_report_summary`, Pro report exports, hosted Send,
  read-only email-attempt status, active-client transitions, stable entitlement
  errors, and generated bridge schemas. Artifact publication/versioning remains
  a separate approval-gated release train.
- [x] Pass the subscription-aware agent release gate and align unpublished local
  candidates at bridge/MCP `1.2.0`, OpenClaw `1.2.0`, Claude `1.2.0`, and
  ClawHub skill `1.3.0`. No package, registry, marketplace, plugin, or skill was
  published by Program Phase 1.
- [ ] Complete the remaining installed native-plugin write/timer journey: inspect/create task, start timer, later stop the same timer, and verify one time entry. Migration, pairing/read, refresh/reopen, and restart recovery are complete.
- [x] Configure and verify the `CLAWHUB_TOKEN` GitHub Actions secret without exposing its value; dry runs require no secret.
- [x] Publish native OpenClaw `1.1.0` to ClawHub through its GitHub Actions trusted publisher and independently verify owner `tasktimepro`, clean scan state, repository/path, and immutable source SHA `f952ee0`. The unchanged skill required no republication.
- [x] Publish and verify agent bridge `1.1.0` on npm and MCP Registry, and publish OpenClaw `1.1.0` publicly on npm with exact source commit `5d4d02c`. The OpenClaw workflow's former access-mutation post-step failed after the package was already public; the local release fix replaces it with a read-only version check.
- [x] Keep bridge package, vendored bundles, generated tool catalogs, public docs, and MCP Registry metadata synchronized for the provider-neutral release.
- [x] Add canonical provider-neutral cloud sync/backup commands for the Dropbox implementation, retain already-shipped Drive-named commands only as deprecated Google-only compatibility aliases, route hosted email through the active Google Drive or Dropbox session, and prepare the additive bridge `1.1.0`, OpenClaw `1.1.0`, Claude `1.1.0`, and Claude marketplace `1.3.0` artifacts. The npm bridge/OpenClaw and MCP Registry records are published; the repository-backed Claude artifacts ship through `main`; the unchanged ClawHub skill remains `1.2.1`.
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
- [x] Prepare the earlier durability-only candidate as core app `1.4.0`, agent bridge/MCP Registry `1.0.0`, OpenClaw and Claude bundles `1.0.0`, and ClawHub skill/Claude marketplace `1.2.0`; the current provider-neutral release train above supersedes that unpublished candidate.

## Production baseline

- [x] Browser-owned command context and scoped command registry
- [x] Loopback-only MCP bridge with pairing, sessions, approvals, revocation, and rate limiting
- [x] npm bridge package plus OpenClaw and Claude Code bundles
- [x] Public agent docs, discovery manifests, and generated tool catalog
- [x] Unit, protocol, bundle, smoke, and live-validation paths

Publishing details remain governed by `docs/agent-release-runbook.md`.

The provider-neutral bridge `1.1.0`, OpenClaw npm bundle `1.1.0`, MCP Registry
record, repository-backed Claude artifacts, and native OpenClaw ClawHub `1.1.0`
record are published. npm artifacts resolve to app release commit `5d4d02c`;
ClawHub resolves to the later workflow-only source commit `f952ee0` and retains
the verified `tasktimepro/tasktime` package path and trusted-publisher binding.
