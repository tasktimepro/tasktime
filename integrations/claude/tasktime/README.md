# TaskTime Pro Claude Code Plugin

This plugin adds TaskTime Pro skill guidance and a bundled MCP server configuration for Claude Code.

TaskTime Pro remains local-first. The plugin launches the same-device TaskTime Pro agent bridge, and the user must still pair the visible TaskTime Pro browser app from Account > Agent Access before local data is readable or mutable.

## Install

Add the TaskTime Pro marketplace in Claude Code:

```text
/plugin marketplace add https://github.com/tasktimepro/tasktime
```

Install the plugin:

```text
/plugin install tasktime@tasktimepro
```

Reload plugins if Claude Code asks for it:

```text
/reload-plugins
```

## Use

- Skill namespace: `/tasktime:tasktime`
- MCP server: `plugin:tasktime:tasktime`
- Example MCP tool name: `mcp__plugin_tasktime_tasktime__list_projects`

Open TaskTime Pro, go to Account > Agent Access, and approve the local pairing request before using tools.

For plugin-managed installs, pair TaskTime Pro to the active Claude-owned MCP bridge, not to a separately launched terminal bridge. Use the bridge-local `get_pairing_status` tool to find the exact dynamic localhost endpoint and TaskTime Pro launch URL. If the code expired or was already consumed, call `refresh_pairing` and use the new launch URL.

This plugin identifies itself as `tasktime.agent.claude-code` / `Claude Code on this device`, writes `tasktime-agent-bridge.status.json` beside the launcher, and uses a 24-hour app-session TTL for normal work sessions. Pairing codes remain short-lived and single-use.

Claude clients that support MCP but not Claude Code plugins can use the standalone bridge package instead:

```json
{
  "mcpServers": {
    "tasktime": {
      "command": "npx",
      "args": ["-y", "@tasktimepro/agent-bridge", "--app-url", "https://tasktime.pro"]
    }
  }
}
```

## References

- Claude setup: https://tasktime.pro/agents/claude/
- Agent docs: https://tasktime.pro/agents/
- Security model: https://tasktime.pro/agents/security/
- MCP tools: https://tasktime.pro/agents/tools/

License: the skill instructions are `MIT-0`; see `LICENSE`. The bundled TaskTime Pro bridge is `AGPL-3.0-only`; see `LICENSE.agent-bridge`.
