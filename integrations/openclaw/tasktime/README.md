# TaskTime Pro OpenClaw Bundle

This bundle gives OpenClaw-compatible agent platforms two TaskTime Pro integration pieces:

- `skills/tasktime/SKILL.md` with agent instructions for safe TaskTime Pro use.
- `.mcp.json` with a `tasktime` MCP stdio server entry that launches the TaskTime Pro bridge.

The MCP server uses the `@tasktimepro/agent-bridge` package and still requires the user to pair the running TaskTime Pro browser app from Account > Agent Access before any local data is readable or mutable.

Useful references:

- https://tasktime.pro/agents/openclaw/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/

License: `MIT-0` for this OpenClaw/ClawHub bundle; see `LICENSE`. The TaskTime Pro bridge binary it launches is licensed separately under `AGPL-3.0-only`.
