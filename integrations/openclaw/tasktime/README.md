# TaskTime Pro OpenClaw Bundle

TaskTime Pro is a free, open-source, local-first work manager for freelancers, covering tasks, timers, expenses, invoices, and reports. Core use requires no TaskTime account or cloud sync, works offline after the PWA is loaded or installed, and stores work records in the browser.

This bundle gives OpenClaw-compatible agent platforms two TaskTime Pro integration pieces:

- `skills/tasktime/SKILL.md` with agent instructions for safe TaskTime Pro use.
- `.mcp.json` with a `tasktime` MCP stdio server entry that launches the TaskTime Pro bridge.

The MCP server launches the bundled TaskTime Pro agent bridge and still requires the user to pair the running TaskTime Pro browser app from Account > Agent Access before any local data is readable or mutable.

The billing-scoped bridge can cancel an eligible finalized unpaid invoice only with explicit TaskTime Pro approval, a reason, and exact invoice-number confirmation; the invoice remains as a numbered audit record.

For OpenClaw-managed installs, pair TaskTime Pro to the active MCP-owned bridge, not to a separately launched terminal bridge. Use the bridge-local `get_pairing_status` tool to find the exact dynamic localhost endpoint and TaskTime Pro launch URL. If the code expired or was already consumed, call `refresh_pairing` and use the new launch URL.

This bundle identifies itself as `tasktime.agent.openclaw` / `OpenClaw on this device`, writes `tasktime-agent-bridge.status.json` beside the launcher, and uses a 24-hour app-session TTL for normal work sessions. Pairing codes remain short-lived and single-use.

For the standalone ClawHub skill, always use the owner-qualified TaskTime Pro reference:

```bash
openclaw skills install @tasktimepro/tasktime-agent
```

If you install only the standalone skill, install `@tasktimepro/agent-bridge` separately and expose it to your MCP client as `tasktime-agent-bridge --app-url https://tasktime.pro`.

Useful references:

- https://tasktime.pro/agents/openclaw/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/

License: the skill instructions are `MIT-0`; see `LICENSE`. The bundled TaskTime Pro bridge is `AGPL-3.0-only`; see `LICENSE.agent-bridge`.
