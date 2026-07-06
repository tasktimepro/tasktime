# TaskTime Agent Bridge

`@tasktime/agent-bridge` provides the `tasktime-agent-bridge` binary used by same-device AI agents to talk to TaskTime over MCP stdio.

The bridge does not read or write TaskTime IndexedDB/Yjs data directly. It starts a loopback app-session endpoint, waits for the running TaskTime browser app to pair through Account > Agent Access, and forwards MCP tool calls to the paired browser app.

Useful commands:

```bash
tasktime-agent-bridge --manifest
tasktime-agent-bridge --app-url https://tasktime.pro
```

Public docs:

- https://tasktime.pro/agents/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/
