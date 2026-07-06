# TaskTime OpenClaw Bundle

This bundle gives OpenClaw-compatible agent platforms two TaskTime integration pieces:

- `skills/tasktime/SKILL.md` with agent instructions for safe TaskTime use.
- `.mcp.json` with a `tasktime` MCP stdio server entry that launches the TaskTime bridge.

The MCP server uses the `@tasktime/agent-bridge` package and still requires the user to pair the running TaskTime browser app from Account > Agent Access before any local data is readable or mutable.

Useful references:

- https://tasktime.pro/agents/openclaw/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/
