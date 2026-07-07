# TaskTime Pro OpenClaw Bundle

This bundle gives OpenClaw-compatible agent platforms two TaskTime Pro integration pieces:

- `skills/tasktime/SKILL.md` with agent instructions for safe TaskTime Pro use.
- `.mcp.json` with a `tasktime` MCP stdio server entry that launches the TaskTime Pro bridge.

The MCP server launches the bundled TaskTime Pro agent bridge and still requires the user to pair the running TaskTime Pro browser app from Account > Agent Access before any local data is readable or mutable.

If you install only the standalone skill, install `@tasktimepro/agent-bridge` separately and expose it to your MCP client as `tasktime-agent-bridge --app-url https://tasktime.pro`.

Useful references:

- https://tasktime.pro/agents/openclaw/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/

License: the skill instructions are `MIT-0`; see `LICENSE`. The bundled TaskTime Pro bridge is `AGPL-3.0-only`; see `LICENSE.agent-bridge`.
