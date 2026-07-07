---
name: tasktime
description: Use TaskTime Pro through its local MCP bridge for task management, time tracking, expenses, reports, invoices, project quotes, planner notes, backups, sync settings, app navigation, or account data. Trigger when a user asks an agent to inspect or operate TaskTime Pro data, set up TaskTime Pro agent access, recover a TaskTime Pro bridge session, or choose the correct TaskTime Pro MCP tool.
license: MIT-0
metadata:
  openclaw:
    homepage: https://tasktime.pro/agents/openclaw/
    requires:
      bins:
        - node
    install:
      - kind: node
        package: "@tasktimepro/agent-bridge"
        bins:
          - tasktime-agent-bridge
---

# TaskTime Pro

## Overview

Use TaskTime Pro MCP tools before browser UI automation. TaskTime Pro is local-first customer data, so treat the paired browser app as the authority and never ask the user to reset browser data or Drive sync state as a normal fix.

Public references:

- Agent docs: https://tasktime.pro/agents/
- Quickstart: https://tasktime.pro/agents/quickstart/
- Security model: https://tasktime.pro/agents/security/
- MCP tool reference: https://tasktime.pro/agents/tools/
- Machine-readable MCP tools: https://tasktime.pro/agents/mcp-tools.json
- Bridge discovery manifest: https://tasktime.pro/.well-known/tasktime-agent.json
- Debugging guide: https://tasktime.pro/agents/debugging/

## Connect

Launch the bridge as an MCP stdio server:

```bash
tasktime-agent-bridge --app-url https://tasktime.pro
```

If this skill was installed through the TaskTime Pro OpenClaw bundle, use the bundle-provided MCP server instead of requiring a global `tasktime-agent-bridge` binary. Require a running paired TaskTime Pro browser session before reading or mutating data. The user grants first-use access in TaskTime Pro under Account > Agent Access. If the OpenClaw bundle installed the MCP server, expect TaskTime Pro tools to be exposed with the server prefix, such as `tasktime__list_projects`.

Call `tools/list` at runtime because available tools depend on the granted bridge scopes. Default scopes are `read`, `write`, and `navigation`; optional scopes are `billing`, `export`, and `email`.

## Operating Rules

- Use MCP tools for data work and UI automation only for visual validation or unsupported workflows.
- Preserve TaskTime Pro's local-only boundary. Do not expose the bridge through public interfaces or tunnels.
- Use a valid exact-input TaskTime Pro approval token or the browser-visible prompt for approval-gated actions.
- Do not invent raw Yjs, IndexedDB, invoice, sync, or billing mutations outside the bridge.
- Prefer read/preview tools before write, billing, export, email, or destructive actions.
- Keep the user in control for invoice finalization, email sending, export, account data deletion, and cascade deletes.

## Useful First Calls

- `list_projects` to inspect available projects.
- `list_clients` to inspect client records.
- `get_active_timers` to inspect running timers.
- `create_task` to create scoped work inside an existing project.
- `start_timer` to begin time tracking.
- `find_unbilled_time` or `preview_invoice_from_unbilled_work` before invoice drafting.
- `open_project_view`, `open_invoice_view`, or `open_reports_view` to bring the user to a review screen.

## Recovery

If a tool call returns an unavailable app-session error with `launch_tasktime`, open or guide the user to TaskTime Pro, pair Account > Agent Access, then retry. Do not treat this as a generic failure.

Use DebugBundle only for runtime or customer-facing incidents, endpoint downtime, health checks, webhook or notification failures, noisy captured incidents, or symptoms likely to have generated captured events. For deterministic local code, docs, UI, refactor, or test failures, inspect source and tests first.
