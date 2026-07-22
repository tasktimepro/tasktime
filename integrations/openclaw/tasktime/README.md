# TaskTime Pro OpenClaw Plugin

TaskTime Pro is a free, open-source, local-first work manager for freelancers, covering tasks, timers, expenses, invoices, and reports. Core use requires no TaskTime account or cloud sync, works offline after the PWA is loaded or installed, and stores work records in the browser.

This package gives OpenClaw a complete TaskTime Pro integration:

- `openclaw.plugin.json` and `dist/index.js` provide the native Gateway-lifecycle plugin.
- The native plugin owns one vendored TaskTime bridge across ordinary agent turns and exposes generated `tasktime__*` tools.
- `skills/tasktime/SKILL.md` provides safe TaskTime Pro operating guidance.
- `.mcp.json` remains as a compatibility artifact for non-native bundle consumers; OpenClaw native format takes precedence.

Install the complete integration, then restart the Gateway:

```bash
openclaw plugins install @tasktimepro/openclaw
openclaw gateway restart
openclaw plugins inspect tasktime --runtime
```

The plugin still requires the user to pair the running TaskTime Pro browser app from Account > Agent Access before local data is readable or mutable.

The billing-scoped bridge can cancel an eligible finalized unpaid invoice only with explicit TaskTime Pro approval, a reason, and exact invoice-number confirmation; the invoice remains as a numbered audit record.

For OpenClaw-managed installs, pair TaskTime Pro to the Gateway-owned bridge, not to a separately launched terminal bridge. Use `tasktime__get_pairing_status` to obtain the short-lived launch URL. If its code expired or was consumed, call `tasktime__refresh_pairing`.

The plugin identifies itself as `tasktime.agent.openclaw` / `OpenClaw on this device`. Refreshing TaskTime restores the current tab from `sessionStorage`; closing and reopening it in the same browser profile uses a non-exportable browser signing key to obtain a fresh session. The bearer token is never stored durably. A Gateway/bridge restart, explicit disconnect, revoke, disable, expiry, or forgotten browser authorization requires pairing again.

If an older `mcp.servers.tasktime` entry is still configured, the native plugin refuses to start a duplicate bridge and reports `legacy_mcp_conflict`. Migrate it explicitly with OpenClaw's validated config commands:

```bash
mkdir -p ~/.openclaw/backups
chmod 700 ~/.openclaw/backups
openclaw backup create --only-config --verify --output ~/.openclaw/backups
openclaw config get mcp.servers.tasktime
openclaw config unset mcp.servers.tasktime --dry-run
openclaw config unset mcp.servers.tasktime
openclaw config validate
openclaw gateway restart
openclaw plugins inspect tasktime --runtime
```

If the diagnostic names the historical `mcpServers.tasktime` path, use that exact path in the three config commands. Keep the backup and the value printed by `config get` until the native flow is verified. To roll back, disable the native plugin, restore the saved value with `openclaw config set <path> '<saved-json>' --strict-json` (preview it with `--dry-run` first), validate, and restart the Gateway. Never run both owners together.

For the standalone ClawHub skill, always use the owner-qualified TaskTime Pro reference:

```bash
openclaw skills install @tasktimepro/tasktime-agent
```

The standalone ClawHub skill is the portable/advanced path. If you install only that skill, install `@tasktimepro/agent-bridge` separately and expose it to your MCP client as `tasktime-agent-bridge --app-url https://tasktime.pro`.

Useful references:

- https://tasktime.pro/agents/openclaw/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/

License: the skill instructions are `MIT-0`; see `LICENSE`. The bundled TaskTime Pro bridge is `AGPL-3.0-only`; see `LICENSE.agent-bridge`.
