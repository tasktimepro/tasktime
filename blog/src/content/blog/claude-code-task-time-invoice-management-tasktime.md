---
title: "Claude Code for Freelancers: Tasks, Time Tracking, Expenses, and Invoices"
description: "Use the TaskTime Pro Claude Code plugin to manage projects, timers, expenses, invoice drafts, reports, and app navigation through a local MCP bridge."
publishedAt: "2026-07-06"
excerpt: "Claude Code can now work with TaskTime Pro through a local plugin and MCP bridge, giving freelancers agent help for project admin without bypassing the app."
category: "workflow"
tags: ["Claude Code", "AI agents", "MCP", "invoicing"]
keywords: ["Claude Code task management", "Claude Code time tracking", "Claude Code invoicing", "Claude Code MCP plugin", "freelance task management with Claude", "AI invoice assistant", "TaskTime Pro Claude plugin", "Claude Code freelancer workflow", "MCP server for Claude Code", "AI agent for invoices"]
ogImage: "/icons/web-app-manifest-512x512.png"
ogImageAlt: "TaskTime Pro app icon"
socialTitle: "Claude Code for Freelance Task, Time, and Invoice Management"
socialDescription: "Use Claude Code with TaskTime Pro's local MCP bridge to plan tasks, track time, review expenses, prepare invoices, and open the right app screens."
draft: false
---

Claude Code is useful because it can work with tools, projects, and context. For freelancers, that should not stop at source code.

The same agent pattern can help with client admin: plan the next task, start a timer, find unbilled work, draft an invoice, review expenses, or open the exact TaskTime Pro screen you need to check.

TaskTime Pro now has a Claude Code plugin for that workflow.

## What the TaskTime Pro Claude Code plugin does

The plugin gives Claude Code a TaskTime Pro skill and a bundled MCP server configuration. When the plugin is installed and enabled, Claude Code can start the TaskTime Pro local bridge and expose TaskTime Pro tools to the session.

The bridge still requires explicit pairing in the visible browser app:

1. Install the TaskTime Pro Claude Code plugin.
2. Open TaskTime Pro.
3. Go to Account > Agent Access.
4. Pair the running local bridge.
5. Use Claude Code to inspect or update TaskTime Pro through MCP tools.

This is deliberate. Claude does not get silent access to browser storage. The running TaskTime Pro app remains the authority for reads, writes, downloads, email sends, invoice actions, sync behavior, and approvals.

## Install the plugin

Add the TaskTime Pro marketplace in Claude Code:

```text
/plugin marketplace add https://github.com/tasktimepro/tasktime
```

Then install the plugin:

```text
/plugin install tasktime@tasktimepro
```

If Claude Code asks you to reload plugin components, run:

```text
/reload-plugins
```

The plugin MCP server appears as:

```text
plugin:tasktime:tasktime
```

Plugin-bundled MCP tools use Claude's scoped tool-name form, for example:

```text
mcp__plugin_tasktime_tasktime__list_projects
```

For the full setup path, use the [TaskTime Pro Claude Code integration guide](/agents/claude/).

## What Claude Code can help with

For task management, Claude can inspect active projects, create tasks, update task details, complete work, archive old tasks, attach items to the planner, and open project screens for review.

For time tracking, Claude can check active timers, start a timer for the task you are about to work on, pause or resume it, stop it into a time entry, and list recent entries.

For expenses, Claude can help create expenses, review recurring expense templates, mark expenses paid or unpaid, and connect billable expenses to the right client work.

For invoices, Claude can find unbilled time, preview invoice contents, create invoice drafts, prepare quote previews, export PDFs, and send invoice or quote email when the required scopes and approvals are granted.

For reports, Claude can open report screens, summarize work, and prepare export actions for review.

The result is not a chatbot sitting next to your admin tool. It is a local agent workflow connected to the actual app state.

## A practical Claude Code prompt

Once TaskTime Pro is paired, you can ask for something concrete:

```text
Use TaskTime Pro to review my unbilled work for the Acme project.
Preview what would go into an invoice, but do not finalize or send anything.
Open the invoice screen when the draft is ready for review.
```

That prompt has three important parts:

- It names the business goal.
- It asks for preview before mutation.
- It keeps final billing action under human control.

That is the workflow TaskTime Pro is designed for. Claude can collect context and prepare the next step, but sensitive billing actions remain explicit.

## Why this matters for freelancers

Freelance admin has a lot of repetitive context switching.

You check a project, update a task, start a timer, stop the timer, log an expense, remember to invoice it, export a PDF, and then mark the invoice paid later. None of those steps is hard. The problem is that they are spread across time, and missed details cost money.

Claude Code plus TaskTime Pro can reduce that friction:

- "What should I work on today?"
- "Start a timer for this task."
- "Find work I have not invoiced yet."
- "Create a draft invoice from the unbilled entries."
- "Open the reports view for this client."
- "Show me active timers before I switch projects."

Those are high-intent workflows for anyone searching for "AI time tracking," "AI invoice assistant," "Claude Code task management," or "MCP server for invoicing."

## Safety rules that keep the workflow sane

The TaskTime Pro plugin is not meant to let an agent do anything it wants.

Claude should use MCP tools before browser automation. It should inspect before changing data. It should preview invoice and quote work before creating drafts, finalizing invoices, exporting PDFs, or sending email. It should use navigation tools to bring you to the relevant visible app screen.

TaskTime Pro also separates permission scopes:

- `read`
- `write`
- `navigation`
- `billing`
- `export`
- `email`

Default access covers normal read, write, and navigation. Billing, export, and email are optional because they carry more risk.

Destructive, restore, billing, export, and email operations are approval-gated. If there is no valid trusted approval token for the exact input, the browser app can show a visible approval prompt and fail closed when approval is not granted.

## Quick answers

**Can Claude Code manage my TaskTime Pro tasks?**
Yes. With the plugin installed and the app paired, Claude Code can use TaskTime Pro MCP tools for projects, clients, tasks, subtasks, planner items, and navigation.

**Can Claude Code track time?**
Yes. It can start, pause, resume, stop, clear, and inspect timers through the bridge.

**Can Claude Code send invoices automatically?**
Not silently. Invoice email, exports, billing state changes, restore flows, and destructive operations require the right scopes and approval.

**Does the plugin upload my TaskTime Pro data?**
The TaskTime Pro bridge is same-device and local-first. It forwards MCP tool calls to the paired browser app instead of reading raw local storage or creating a TaskTime Pro cloud API.

## Use Claude for the admin loop, not as the owner

The best use of Claude Code with TaskTime Pro is not "do everything for me." It is "help me keep the admin loop tight."

Let Claude assemble context, find missing work, draft safe next steps, and open the right review screen. Keep approvals, invoices, emails, exports, restores, and deletes visible.

That gives you an AI agent for freelance task management, time tracking, expenses, and invoices without giving up the local-first control that makes TaskTime Pro different.
