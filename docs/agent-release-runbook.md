# Agent And MCP Release Runbook

This file is the local source of truth for publishing TaskTime Pro agent-facing artifacts: the MCP bridge npm package, public agent docs, OpenClaw/ClawHub skill, OpenClaw bundle, and Claude Code plugin bundle.

## Canonical Artifacts

- MCP bridge npm package: `@tasktimepro/agent-bridge`
- MCP registry name: `pro.tasktime/agent-bridge`
- Bridge binary: `tasktime-agent-bridge`
- Public bridge manifest: `public/.well-known/tasktime-agent.json`
- Public MCP tool catalog: `https://tasktime.pro/agents/mcp-tools.json`
- OpenClaw/ClawHub skill slug: `@tasktimepro/tasktime-agent`
- Native OpenClaw plugin path: `integrations/openclaw/tasktime/`
- Claude Code plugin path: `integrations/claude/tasktime/`

The canonical ClawHub skill is `@tasktimepro/tasktime-agent`. The legacy slugs
`@tasktimepro/tasktime` and `@tasktimepro/tasktime-pro` redirect to it. Keep
the internal OpenClaw skill key as `tasktime` so managed installs retain their
existing local skill identity.

## Agent Bridge UX Contract

TaskTime Pro pairing must be smooth for managed agent platforms:

- Pairing codes stay short-lived and single-use. Do not lengthen pairing codes to days or months.
- App sessions default to normal work-session length: 24 hours unless a host explicitly overrides `--session-ttl-ms`.
- After pairing, the current tab keeps the bounded app-session token in `sessionStorage` for refresh recovery. It must never enter localStorage, IndexedDB, Yjs, Drive, backups, logs, status files, docs, or MCP recovery payloads.
- Same-profile close/reopen continuity uses a non-exportable browser signing key and bridge challenge/response to issue a fresh session. The bridge public authorization remains memory-only and ends on bridge/Gateway restart.
- Stable trust identity comes from `--agent-id` and `--agent-label`, not the dynamic WebSocket port.
- Trusted chat approval grants default to "until revoked" for stable same-device managed agents. The UI may also offer shorter grants such as "today" or "30 days", but the smooth path should not force recurring monthly re-trust.
- OpenClaw uses `tasktime.agent.openclaw` / `OpenClaw on this device`.
- Claude Code uses `tasktime.agent.claude-code` / `Claude Code on this device`.
- Managed integrations should pass `--status-file` for non-secret endpoint, PID, instance, identity, expiry, and browser-session discovery. Pairing IDs/codes and launch URLs must remain in ephemeral interactive/MCP setup output.
- Agents should use `get_pairing_status` before giving setup instructions, and `refresh_pairing` when a pairing code expired or was consumed.
- Agents must not ask users to run a separate `tasktime-agent-bridge` terminal process when the installed MCP server already owns a bridge.
- Current TaskTime Pro app builds show requested scopes in the launch approval notice before connection and confirmed scopes after connection; do not document user-selectable scopes unless the app gains a visible scope picker.
- Task-and-time-management validation must include the long-running flow: inspect/create task, start timer, let the user work, later stop the same timer and verify the created time entry.

## Credentials

ClawHub CLI auth is stored locally at:

```text
~/Library/Application Support/clawhub/config.json
```

Never print, paste, or commit this file's contents. When running the ClawHub CLI from a Linux container, mount that directory as `/root/.config/clawhub`:

```bash
docker run --rm \
  -v "$HOME/Library/Application Support/clawhub:/root/.config/clawhub:ro" \
  node:24-alpine \
  sh -lc 'npx -y clawhub@0.23.1 auth whoami'
```

The expected owner account should be able to manage the `tasktimepro` publisher. If auth fails, log in with the ClawHub device flow or refresh the local config outside the repo.

npm publishing uses GitHub Actions and the `NPM_TOKEN` repository secret:

```text
.github/workflows/publish-agent-bridge.yml
```

ClawHub publishing uses a manually dispatched, dry-run-first GitHub Actions
workflow and the `CLAWHUB_TOKEN` repository secret:

```text
.github/workflows/publish-clawhub-skill.yml
```

ClawHub does not currently support GitHub OIDC trusted publishing for skills.
Keep the token in GitHub Actions secrets; never place it in repository files,
workflow inputs, logs, or release notes.

One-time repository setup, performed interactively by an authorized maintainer:

```bash
gh secret set CLAWHUB_TOKEN --repo tasktimepro/tasktime
```

Paste the ClawHub publisher token only into that hidden prompt.

MCP Registry publishing uses the domain proof at `https://tasktime.pro/.well-known/mcp-registry-auth`.
The matching private key is stored on the release machine at:

```text
~/.ssh/tasktime-mcp-registry-p384.pem
```

The GitHub Actions workflow uses the same key as raw ECDSA P-384 private-key hex in the `MCP_REGISTRY_PRIVATE_KEY` repository secret:

```text
.github/workflows/publish-mcp-registry.yml
```

Do not commit the private key, PEM contents, or derived private-key hex. If the key is rotated, update `public/.well-known/mcp-registry-auth`, deploy production so the new public proof is live, then update `MCP_REGISTRY_PRIVATE_KEY`.

## Pre-Release Checks

Run Node/npm commands through Docker for this app:

```bash
make release-gate
make npm CMD="run release:agent"
```

For bridge-only changes, the minimum useful local check is:

```bash
make npm CMD="run build:agent-bridge"
make npm CMD="run smoke:agent-bridge"
make npm CMD="run smoke:agent-bundles"
```

Use `smoke:agent-live` before publishing bridge behavior changes that affect browser pairing, command routing, or MCP tool calls.
For managed integration changes, also validate the OpenClaw/Claude launcher path: the bundle starts one bridge, writes a status file, exposes `get_pairing_status`/`refresh_pairing`, pairs the browser app to that same bridge, and successfully calls `list_projects`.

## MCP Bridge Release

1. Update bridge source under `src/agent/**`.
2. Bump `agent-bridge/package.json` version.
3. Build the bridge:

```bash
make npm CMD="run build:agent-bridge"
```

4. If the OpenClaw or Claude bundles ship the bridge, refresh vendored copies:

```bash
cp agent-bridge/dist/tasktime-agent-bridge.mjs integrations/openclaw/tasktime/vendor/tasktime-agent-bridge.mjs
cp agent-bridge/dist/tasktime-agent-bridge.mjs integrations/claude/tasktime/vendor/tasktime-agent-bridge.mjs
```

5. Re-run smoke checks:

```bash
make npm CMD="run smoke:agent-bridge"
make npm CMD="run smoke:agent-bundles"
make npm CMD="run smoke:agent-live"
```

6. Use the GitHub workflow `Publish Agent Bridge to npm`.
   - First run with `dry_run=true`.
   - Then run with `dry_run=false`.
   - The workflow verifies the version is not already published and runs `npm pack --dry-run`.

7. After publishing, verify:

```bash
docker compose run --rm app npm view @tasktimepro/agent-bridge version
docker compose run --rm app npx -y @tasktimepro/agent-bridge --manifest
```

8. Publish the official MCP Registry metadata after the npm package is live and the production `.well-known/mcp-registry-auth` proof matches the active key:

```bash
gh workflow run publish-mcp-registry.yml --ref main
```

9. Verify the official MCP Registry latest version:

```bash
curl 'https://registry.modelcontextprotocol.io/v0/servers?search=pro.tasktime%2Fagent-bridge'
```

## Public Agent Docs

Agent docs are generated by the main build:

- `blog/src/pages/agents/**`
- `blog/src/pages/agents/mcp-tools.json.js`
- `blog/src/pages/agents/tasktime-agent-bridge.json.js`
- `blog/src/pages/agents/skill.md.js`
- `public/.well-known/tasktime-agent.json`

Build and preview them with:

```bash
make build
make preview-build
```

Check these URLs in the local preview:

- `/agents/`
- `/agents/quickstart/`
- `/agents/tools/`
- `/agents/mcp-tools.json`
- `/agents/skill.md`
- `/.well-known/tasktime-agent.json`
- `/tasktime-agent.json`

## ClawHub Skill Update

The ClawHub skill source is:

```text
integrations/openclaw/tasktime/skills/tasktime/SKILL.md
```

Keep the frontmatter `name: tasktime` and `metadata.openclaw.skillKey: tasktime`.
They are the installed OpenClaw identity, not the public ClawHub URL. Bump the
skill `version` when the instructions or published metadata materially change.
Always publish the explicit canonical ClawHub slug and display name. The
canonical install command is:

```bash
openclaw skills install @tasktimepro/tasktime-agent
```

The canonical release path is the manually dispatched GitHub Actions workflow.
It reads the exact version from `SKILL.md`, refuses to publish from a fork,
pins the public `tasktimepro/tasktime` repository plus the workflow's exact
commit and skill path, and verifies the resulting publisher identity, Skill
Card, and server-resolved GitHub provenance.

Run the dry-run first:

```bash
gh workflow run publish-clawhub-skill.yml --ref main -f dry_run=true
gh run watch
```

After the coordinated release checks pass and the user explicitly approves the
ClawHub publication, run the real release:

```bash
gh workflow run publish-clawhub-skill.yml --ref main -f dry_run=false
gh run watch
```

Do not run the real workflow from a commit that has not completed the intended
release gates. The workflow publishes the version declared in the checked-out
`SKILL.md`; it never lets ClawHub silently choose the next patch version.

The local CLI commands below are an emergency/manual fallback. Use them only
from the canonical repository at a pushed commit whose `SKILL.md` bytes match
that commit.

Use the standalone ClawHub CLI with Node 24:

```bash
docker run --rm \
  -v "$PWD:/repo" \
  -v "$HOME/Library/Application Support/clawhub:/root/.config/clawhub:ro" \
  -w /repo \
  node:24-alpine \
  sh -lc 'npx -y clawhub@0.23.1 auth whoami'
```

Dry-run or inspect before publishing when possible. Pin the public source
repository, commit, and skill path so ClawHub can associate the submitted bytes
with the canonical first-party source:

```bash
gh workflow run publish-clawhub-skill.yml --ref main -f dry_run=true
```

Publish:

```bash
gh workflow run publish-clawhub-skill.yml --ref main -f dry_run=false
```

Verify:

```bash
docker run --rm \
  -v "$HOME/Library/Application Support/clawhub:/root/.config/clawhub:ro" \
  node:24-alpine \
  sh -lc 'npx -y clawhub@0.23.1 skill verify @tasktimepro/tasktime-agent'
```

This command must return `"ok": true`, `publisherHandle: "tasktimepro"`, the
exact published version, `card.available: true`, and
`provenance.source: "server-resolved-github-import"`. The generated card is
part of ClawHub's verification contract, even when every security scanner is
clean. Confirm the card itself is available with:

```bash
docker run --rm \
  -v "$HOME/Library/Application Support/clawhub:/root/.config/clawhub:ro" \
  node:24-alpine \
  sh -lc 'npx -y clawhub@0.23.1 skill verify @tasktimepro/tasktime-agent --card'
```

Read the generated card as a semantic review, not only an availability check.
It must describe TaskTime Pro and the submitted skill without inventing access
to unrelated services, release workflows, messaging platforms, shared memory,
or other capabilities absent from `SKILL.md`. Request a rescan and then contact
ClawHub support if the generated card remains inaccurate.

ClawHub CLI `0.23.1` accepts GitHub repository, commit, ref, and path provenance
but exposes no publisher-signature option. Verification may therefore continue
to report `signature.status: unsigned`; do not describe the skill as signed.
First-party verification depends on the `tasktimepro` publisher identity plus
server-resolved GitHub provenance. Treat unavailable or self-declared-only
provenance as an incomplete release follow-up even when security scans pass.

Also test unqualified resolution, because it is the natural verification path
after an OpenClaw search. It must resolve to the same `TaskTime Pro` publisher
and canonical `tasktime-agent` slug:

```bash
clawhub skill verify tasktime-agent
openclaw skills verify tasktime-agent
```

ClawHub generates `skill-card.md` server-side after publish or scan completion;
there is no publisher CLI command to generate it manually. If verification is
clean except for `card.missing`, request one ClawHub rescan and wait for the
card job. If the card is still missing, contact ClawHub support with the slug,
version, verification JSON, and artifact fingerprint. Do not republish only to
retry card generation.

If a duplicate owned slug appears again, merge the duplicate into the canonical slug instead of deleting it:

```bash
docker run --rm \
  -v "$HOME/Library/Application Support/clawhub:/root/.config/clawhub:ro" \
  node:24-alpine \
  sh -lc 'npx -y clawhub@0.23.1 skill merge @tasktimepro/<duplicate-slug> @tasktimepro/tasktime-agent --yes'
```

## Native OpenClaw Plugin

The OpenClaw bundle is in:

```text
integrations/openclaw/tasktime/
```

Important files:

- `package.json`
- `openclaw.plugin.json`
- `src/index.js`
- `dist/index.js`
- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/tasktime/SKILL.md`
- `scripts/run-tasktime-agent-bridge.mjs`
- `vendor/tasktime-agent-bridge.mjs`

The native plugin is the primary OpenClaw path. It must activate on Gateway startup, register one supervised bridge service, expose generated `tasktime__*` tools, retain the skill directory, bind the bridge to loopback, and use `tasktime.agent.openclaw` / `OpenClaw on this device`. The retained `.mcp.json` is a compatibility artifact and must not become a second OpenClaw owner when native format is present.

The native plugin writes a secret-free discovery status below the OpenClaw state directory. Its setup tools return the ephemeral pairing launch URL. Legacy `mcp.servers.tasktime` config must produce `legacy_mcp_conflict` instead of starting a duplicate bridge.

When bridge behavior changes, refresh `vendor/tasktime-agent-bridge.mjs` from `agent-bridge/dist/` after `build:agent-bridge`, then run `build:openclaw-plugin`. The publish workflow performs both steps before package smoke and packing.

If the OpenClaw bundle package is published to npm, bump `integrations/openclaw/tasktime/package.json` and use the repo workflow:

```bash
gh workflow run publish-openclaw-bundle.yml --ref main -f dry_run=true
gh workflow run publish-openclaw-bundle.yml --ref main -f dry_run=false
docker compose run --rm app npm view @tasktimepro/openclaw version
```

## Claude Code Plugin Bundle

The Claude Code plugin bundle is in:

```text
integrations/claude/tasktime/
```

Important files:

- `.claude-plugin/plugin.json`
- `.mcp.json`
- `skills/tasktime/SKILL.md`
- `scripts/run-tasktime-agent-bridge.mjs`
- `vendor/tasktime-agent-bridge.mjs`

The marketplace install path is repository-backed:

```text
/plugin marketplace add https://github.com/tasktimepro/tasktime
/plugin install tasktime@tasktimepro
```

The Claude `.mcp.json` must pass `--agent-id tasktime.agent.claude-code`, `--agent-label "Claude Code on this device"`, and a work-session-length `--session-ttl-ms`. The launcher writes a secret-free `tasktime-agent-bridge.status.json` next to the plugin by default; pairing URLs come from the setup tool.

When bridge behavior changes, refresh `vendor/tasktime-agent-bridge.mjs` from `agent-bridge/dist/` after `build:agent-bridge`. Bump `.claude-plugin/plugin.json` when the plugin bundle changes in a way users should receive as a new plugin version.

## Final Sanity Checks

Before tagging or announcing an agent release:

- `make release-gate` passes.
- `make npm CMD="run release:agent"` passes or the skipped part is explicitly documented.
- `@tasktimepro/agent-bridge` npm version matches the intended bridge release.
- `@tasktimepro/tasktime-agent` is the only canonical TaskTime Pro ClawHub skill under owner `tasktimepro`.
- `@tasktimepro/tasktime` and `@tasktimepro/tasktime-pro` redirect to `@tasktimepro/tasktime-agent` if inspected.
- `clawhub skill verify @tasktimepro/tasktime-agent` returns `"ok": true` and a generated Skill Card.
- ClawHub verification identifies the canonical public source repository, exact commit, and skill path as server-resolved GitHub provenance; unavailable or merely self-declared provenance blocks release completion.
- The generated Skill Card contains no unrelated or invented capabilities.
- Unqualified `clawhub skill verify tasktime-agent` and `openclaw skills verify tasktime-agent` resolve to TaskTime Pro.
- Public docs point to `@tasktimepro/tasktime-agent`, `@tasktimepro/agent-bridge`, and `pro.tasktime/agent-bridge`.
- Vendored bridge files match `agent-bridge/dist/tasktime-agent-bridge.mjs` when a bundle includes the bridge.
- Managed bundle tests verify `get_pairing_status`, `refresh_pairing`, stable agent identity, status-file output, and the create/start/stop timer workflow.
