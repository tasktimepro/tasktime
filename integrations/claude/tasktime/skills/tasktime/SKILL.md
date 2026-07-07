---
name: tasktime
description: >-
  Operate local-first TaskTime Pro through its MCP bridge for task planning,
  client work, time tracking, expenses, invoices, quotes, reports, planner notes,
  backups, app navigation, same-device setup, pairing recovery, tool selection,
  and approval-gated workflows in Claude Code.
---

# TaskTime Pro

Use this skill when a user asks you to work with TaskTime Pro through its local agent bridge: plan or update work, manage tasks and clients, track time, prepare invoice data, inspect reports, handle expenses, open app review screens, or recover agent setup.

Stay on the supported TaskTime Pro bridge surface. Do not directly edit browser storage, Yjs documents, Google Drive sync files, invoice records, billing state, or other persisted app data outside TaskTime Pro tools.

## Skill Scope

This is the Claude Code plugin skill for TaskTime Pro. It should guide Claude Code sessions that need safe TaskTime Pro access through the bundled MCP server.

TaskTime Pro is local-first. The paired browser app is the authority for customer data, validation, navigation, downloads, email sends, sync behavior, backups, restore flows, and account deletion. The bridge is a same-device MCP stdio server that forwards approved commands to that visible app session; it is not a remote API.

## Connection

Install from the TaskTime Pro Claude marketplace:

```text
/plugin marketplace add https://github.com/tasktimepro/tasktime
/plugin install tasktime@tasktimepro
```

When the plugin is enabled, Claude Code starts the bundled `tasktime` MCP server automatically. In Claude Code, the server appears as `plugin:tasktime:tasktime`. Plugin-bundled MCP tools use the full name form `mcp__plugin_tasktime_tasktime__<tool-name>`, for example `mcp__plugin_tasktime_tasktime__list_projects`.

The user grants first-use access in TaskTime Pro under Account > Agent Access. Require a running, paired browser session before reading or mutating data. After pairing, check available tools because they depend on the granted scopes. Default scopes are `read`, `write`, and `navigation`; optional scopes are `billing`, `export`, and `email`.

## Operating Workflow

1. Use MCP tools for TaskTime Pro data work. Use browser UI automation only for visual validation or unsupported workflows.
2. Inspect before changing data. Start with list, preview, or read tools before write, billing, export, email, restore, or delete tools.
3. For invoice and quote work, preview unbilled work before creating drafts, finalizing invoices, exporting PDFs, or sending email.
4. For navigation work, use `open_*` view tools to bring the user to the relevant visible app screen for review.
5. For approval-gated actions, use a valid exact-input TaskTime Pro approval token created through `tasktime/create_approval_token`, or let the browser-visible approval prompt handle the action. Do not reuse tokens for changed inputs.
6. Keep the user in control for invoice finalization, email sending, export, account data deletion, restore, sync wiping, and cascade deletes.

## Useful First Tools

- `list_projects`, `list_clients`, and `list_tasks` to understand the current workspace.
- `get_active_timers`, `start_timer`, `pause_timer`, `resume_timer`, and `stop_timer` for time tracking.
- `create_project`, `create_client`, and `create_task` for normal setup and planning.
- `list_expenses` and expense category tools for expense review and entry.
- `find_unbilled_time` and `preview_invoice_from_unbilled_work` before invoice drafting.
- `create_invoice_draft`, `preview_project_quote`, and invoice/quote email tools only within granted scopes and approval rules.
- `open_project_view`, `open_invoice_view`, `open_reports_view`, and other navigation tools to put the user on review screens.

## Recovery

If a tool call returns an unavailable app-session error with `launch_tasktime`, open or guide the user to TaskTime Pro, pair Account > Agent Access, then retry. Do not treat this as a generic MCP failure.

If tool availability does not match the task, inspect the MCP server status and granted scopes. Ask the user to adjust TaskTime Pro Agent Access only when the missing scope is actually needed.

## Safety

- Never expose the bridge through public interfaces, tunnels, shared hosts, or remote control channels.
- Never mutate raw IndexedDB, Yjs documents, Google Drive sync files, invoice state, or billing state outside the TaskTime Pro bridge.
- Never ask the user to reset browser data, clear IndexedDB, or wipe Drive sync state as a normal fix.
- Never print pairing codes, approval tokens, authorization headers, exported account data, invoice PDFs, or email payloads unless the user explicitly asks for that artifact.
- Treat destructive, restore, billing, export, and email tools as high-impact operations: read or preview first, explain the intended action, then mutate only with explicit user intent and TaskTime Pro approval.

## Full Documentation

- Claude setup: https://tasktime.pro/agents/claude/
- Agent docs: https://tasktime.pro/agents/
- Quickstart: https://tasktime.pro/agents/quickstart/
- Security model: https://tasktime.pro/agents/security/
- MCP tool reference: https://tasktime.pro/agents/tools/
- Machine-readable MCP tools: https://tasktime.pro/agents/mcp-tools.json
- Bridge discovery manifest: https://tasktime.pro/.well-known/tasktime-agent.json
- Debugging guide: https://tasktime.pro/agents/debugging/
