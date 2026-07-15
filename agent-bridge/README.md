# TaskTime Pro Agent Bridge

`@tasktimepro/agent-bridge` provides the `tasktime-agent-bridge` binary used by same-device AI agents to talk to TaskTime Pro over MCP stdio.

TaskTime Pro is a free, open-source, local-first work manager for freelancers. Core use requires no TaskTime account or cloud sync, works offline after the PWA is loaded or installed, and stores work records in the browser.

The bridge does not read or write TaskTime Pro IndexedDB/Yjs data directly. It starts a loopback app-session endpoint, waits for the running TaskTime Pro browser app to pair through Account > Agent Access, and forwards MCP tool calls to the paired browser app.

Billing-scoped tools include approval-gated invoice finalization and cancellation. Cancellation is limited to finalized unpaid invoices, retains the invoice number and audit record, and releases only source work owned by that invoice.

Install and run:

```bash
npx @tasktimepro/agent-bridge --app-url https://tasktime.pro
```

Useful commands:

```bash
tasktime-agent-bridge --manifest
tasktime-agent-bridge --app-url https://tasktime.pro
```

Official MCP Registry name: `pro.tasktime/agent-bridge`.

Public docs:

- https://tasktime.pro/agents/
- https://tasktime.pro/agents/quickstart/
- https://tasktime.pro/agents/security/
- https://tasktime.pro/agents/tools/

License: `AGPL-3.0-only`.
