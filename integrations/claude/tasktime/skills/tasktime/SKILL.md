---
name: tasktime
description: >-
  TaskTime Pro is a free, open-source, local-first work manager for freelancers,
  covering tasks, timers, expenses, invoices, and reports. Core use requires no
  TaskTime account or cloud sync, works offline after the PWA is loaded or
  installed, and stores work records in the browser. This first-party TaskTime
  Pro skill lets same-device agents operate the app through scoped access and
  approval controls.
---

# TaskTime Pro

Use this skill when a user asks you to work with TaskTime Pro through its local agent bridge: plan or update work, manage tasks and clients, track time, prepare invoice data, inspect reports, handle expenses, open app review screens, or recover agent setup.

Stay on the supported TaskTime Pro bridge surface. Do not directly edit browser storage, Yjs documents, Google Drive sync files, invoice records, billing state, or other persisted app data outside TaskTime Pro tools.

## Skill Scope

This is the first-party Claude Code plugin skill for TaskTime Pro. It should guide Claude Code sessions that need safe TaskTime Pro access through the bundled MCP server.

TaskTime Pro is free and open source. Core use requires no TaskTime account or cloud sync, works offline after the PWA is loaded or installed, and stores work records in browser-local storage. The production app sends limited aggregate usage metrics without project, task, client, invoice, expense, note, or time-entry content.

The paired browser app is the authority for customer data, validation, navigation, downloads, email sends, sync behavior, backups, restore flows, and account deletion. The bridge is a same-device MCP stdio server that forwards approved commands to that visible app session; it is not a remote API.

## Connection

Install from the TaskTime Pro Claude marketplace:

```text
/plugin marketplace add https://github.com/tasktimepro/tasktime
/plugin install tasktime@tasktimepro
```

When the plugin is enabled, Claude Code starts the bundled `tasktime` MCP server automatically. In Claude Code, the server appears as `plugin:tasktime:tasktime`. Plugin-bundled MCP tools use the full name form `mcp__plugin_tasktime_tasktime__<tool-name>`, for example `mcp__plugin_tasktime_tasktime__list_projects`.

The user grants first-use access in TaskTime Pro under Account > Agent Access. Require a running, paired browser session before reading or mutating data. After pairing, check available tools because they depend on the granted scopes. Default scopes are `read`, `write`, and `navigation`; optional scopes are `billing`, `export`, and `email`. Current TaskTime Pro app builds show scopes after connection; do not tell the user to select scopes in the app unless a future scope picker is visible.

For Claude-plugin-managed installs, do not ask the user to run `tasktime-agent-bridge` manually in Terminal. Pair TaskTime Pro to the active Claude-owned MCP bridge only. The bridge exposes `get_pairing_status` and `refresh_pairing`; use those setup tools to get the exact endpoint, launch URL, stable agent identity, current pairing expiry, and session state. If a pairing code expired or was already used, call `refresh_pairing` and open the returned launch URL.

The Claude plugin uses the stable agent identity `tasktime.agent.claude-code` with the label `Claude Code on this device`. The WebSocket port is dynamic and must not be treated as identity. App sessions are intended to last through normal work sessions, while pairing codes stay short-lived and single-use. Within a running bridge process, browser reconnects resume with a memory-only app-session token; ask the user to re-pair only when status shows no paired session, the session expired, access was revoked, or the bridge process restarted.

Trusted chat approvals default to until revoked for stable same-device managed agents. Shorter trust durations may be available, but do not tell the user they must re-trust every 30 days unless they chose a 30-day grant.

## Operating Workflow

1. Use MCP tools for TaskTime Pro data work. Use browser UI automation only for visual validation or unsupported workflows.
2. Inspect before changing data. Start with list, preview, or read tools before write, billing, export, email, restore, or delete tools.
3. For invoice and quote work, preview unbilled work before creating drafts, finalizing invoices, exporting PDFs, or sending email.
4. For navigation work, use `open_*` view tools to bring the user to the relevant visible app screen for review.
5. For approval-gated actions, use a valid exact-input TaskTime Pro approval token created through `tasktime/create_approval_token`, or let the browser-visible approval prompt handle the action. Do not reuse tokens for changed inputs.
6. Keep the user in control for invoice finalization, email sending, export, account data deletion, restore, sync wiping, and cascade deletes.

## Useful First Tools

- `list_projects`, `list_clients`, and `list_tasks` to understand the current workspace.
- `get_pairing_status` and `refresh_pairing` for setup/recovery before app data tools are available.
- `get_active_timers`, `start_timer`, `pause_timer`, `resume_timer`, and `stop_timer` for time tracking.
- `create_project`, `create_client`, and `create_task` for normal setup and planning.
- `list_expenses` and expense category tools for expense review and entry.
- `find_unbilled_time` and `preview_invoice_from_unbilled_work` before invoice drafting.
- `create_invoice_draft`, `preview_project_quote`, and invoice/quote email tools only within granted scopes and approval rules.
- `open_project_view`, `open_invoice_view`, `open_reports_view`, and other navigation tools to put the user on review screens.

## Recovery

If a tool call returns an unavailable app-session error with `launch_tasktime`, open or guide the user to TaskTime Pro, pair Account > Agent Access, then retry. Do not treat this as a generic MCP failure.

If `get_pairing_status` is available, inspect it before suggesting manual commands. If the status shows no paired app session, use its `launchUrl`; if the pairing is expired or consumed, call `refresh_pairing` and use the new `launchUrl`. Never pair the app to a separately launched terminal bridge when the MCP server is already plugin-managed.

If tool availability does not match the task, inspect the MCP server status and granted scopes. Ask the user to adjust TaskTime Pro Agent Access only when the missing scope is actually needed.

For task-and-time-management workflows, prefer this sequence: inspect projects/tasks, create or choose the task, start the timer, let the user work, later check active timers and stop the matching timer. A timer can reasonably run for hours; do not assume the session should expire after a short chat turn.

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
