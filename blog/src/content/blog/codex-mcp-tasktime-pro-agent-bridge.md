---
title: "Use Codex with TaskTime Pro Through MCP for Local Freelancer Workflows"
description: "Connect Codex to TaskTime Pro's local MCP agent bridge for private task planning, time tracking, invoice preparation, reports, and review workflows."
publishedAt: "2026-07-07"
excerpt: "Codex can work with MCP servers, which makes TaskTime Pro's local agent bridge a useful way to bring project, timer, expense, invoice, and report context into an agent workflow."
category: "workflow"
tags: ["Codex", "MCP", "AI agents", "workflow"]
keywords: ["Codex MCP", "Codex task management", "Codex time tracking", "Codex invoice workflow", "TaskTime Pro Codex", "MCP server for Codex", "AI agent freelancer workflow", "local MCP bridge", "Codex productivity tools", "agentic freelance workflow"]
ogImage: "/icons/web-app-manifest-512x512.png"
ogImageAlt: "TaskTime Pro app icon"
socialTitle: "Use Codex with TaskTime Pro Through MCP"
socialDescription: "Configure Codex with TaskTime Pro's local MCP bridge to help review projects, timers, expenses, invoices, reports, and app navigation."
draft: false
---

Codex is strongest when it can work with real context and real tools. For software projects, that usually means the codebase, terminal commands, tests, and review workflows.

For freelancers and solo professionals, there is another useful context layer: the work ledger.

TaskTime Pro tracks projects, tasks, timers, time entries, expenses, recurring expenses, invoices, reports, and planner data. With the TaskTime Pro agent bridge, Codex can connect to that local app state through MCP instead of relying on pasted summaries.

That makes a different kind of workflow possible: an agent that can help plan the day, inspect time tracking, prepare invoice drafts, review reports, and open the right app screen while TaskTime Pro stays local-first.

## Why Codex plus TaskTime Pro is useful

Codex is often used for code, but many coding sessions are tied to client work.

You might want to know:

- Which project should I work on next?
- Is there already a timer running?
- Did I log time for yesterday's bug fix?
- What billable work is still uninvoiced?
- Can I create a draft invoice for this project?
- Can you open the project screen so I can review it?

Without tools, an agent can only answer from memory or pasted text. With TaskTime Pro's MCP bridge, Codex can ask the app for structured data and call supported actions.

## Configure TaskTime Pro as a Codex MCP server

TaskTime Pro's standalone bridge is an MCP stdio server. Codex supports MCP servers through its MCP configuration, so the bridge can be added as a local server.

A typical configuration looks like this:

```toml
[mcp_servers.tasktime]
command = "npx"
args = ["-y", "@tasktimepro/agent-bridge", "--app-url", "https://tasktime.pro"]
```

After configuration, start Codex, open TaskTime Pro, and pair the local bridge from Account > Agent Access. The bridge cannot read or mutate data until the browser app is running and explicitly paired.

The same package is also runnable directly:

```bash
npx @tasktimepro/agent-bridge --app-url https://tasktime.pro
```

For bridge behavior, scopes, and safety boundaries, start with the [TaskTime Pro agent docs](/agents/) and [MCP tools reference](/agents/tools/).

## What Codex can do after pairing

The TaskTime Pro bridge exposes tools for the parts of freelance workflow that agents can safely help with.

For planning, Codex can list projects, create tasks, update tasks, attach planner items, update project notes, and open the planner or dashboard.

For time tracking, Codex can inspect active timers, start work, pause work, resume work, stop timers into entries, add manual entries, and list recent work.

For expenses, Codex can create and review expenses, manage recurring expense templates, and mark expenses paid or unpaid.

For invoicing, Codex can find unbilled time, preview invoice contents, create invoice drafts, update drafts, generate PDFs, and send invoice email when billing and email scopes are granted and approval rules are satisfied.

For reporting, Codex can open reports, summarize work, export CSV or PDF reports through the browser, and generate accountant packs.

For navigation, Codex can open TaskTime Pro routes in the visible browser app so you can review the outcome.

## A good Codex prompt for TaskTime Pro

Use prompts that keep the agent focused on inspection first:

```text
Use TaskTime Pro to find unbilled work for my active client projects.
Preview the invoice candidates and open the most important one for review.
Do not finalize invoices, send email, export files, or mark anything paid.
```

That asks Codex to do useful work while keeping billing and export actions under explicit control.

For coding sessions, you can combine project work and time tracking:

```text
Check TaskTime Pro for active timers.
If no timer is running, start a timer for the current client project before we begin.
At the end, remind me to stop the timer and review the time entry.
```

The agent does not need to infer the work context from vague notes. It can use the supported app tools.

## Keep Codex inside the supported bridge surface

TaskTime Pro's bridge exists so agents do not need to poke at browser internals.

Codex should not edit IndexedDB, Yjs documents, Google Drive sync files, invoice records, billing state, or local storage directly. It should use TaskTime Pro tools and let the app validate changes.

That matters because TaskTime Pro is production local-first software. The app has rules for recurring expenses, invoice finalization, billed entries, tax-claimed expenses, sync behavior, backups, restores, and deletion impact. The MCP command layer keeps those rules in one place.

## Permission scopes and approvals

TaskTime Pro agent access is scope-gated:

- `read`
- `write`
- `navigation`
- `billing`
- `export`
- `email`

Read, write, and navigation cover normal app help. Billing, export, and email are separate because they can affect client records, files, and communication.

Sensitive operations are approval-gated. In this release, 29 commands require TaskTime Pro approval. A trusted local approval token can satisfy a sensitive prompt only for the exact command input; otherwise the browser-visible approval prompt remains the fallback.

This is the right default for Codex workflows. Let Codex prepare work, verify assumptions, and open review screens. Keep destructive actions, restores, account deletion, invoice finalization, email sends, exports, and payment status changes explicit.

## Quick answers

**Can Codex use TaskTime Pro?**
Yes, through the TaskTime Pro local MCP bridge. Configure the bridge as a Codex MCP server, then pair the running TaskTime Pro browser app from Account > Agent Access.

**Is there a TaskTime Pro Codex plugin?**
The current public path is the standalone MCP bridge package. Claude Code has a plugin bundle; Codex can use the MCP server configuration directly.

**Can Codex create invoices from tracked time?**
It can preview unbilled work and create invoice drafts through the bridge. Finalizing, exporting, emailing, and payment status changes require the right scopes and approval.

**Does this make TaskTime Pro a cloud API?**
No. The bridge is same-device. The paired browser app remains responsible for data access, validation, mutations, downloads, email sends, sync behavior, and approvals.

## The practical value

The best Codex plus TaskTime Pro workflow is not about replacing judgment. It is about removing small admin gaps.

Start the right timer. Find the task. Review unbilled work. Draft the invoice. Open the report. Keep billing changes visible. Keep private data local-first.

That is a useful place for an AI agent: close enough to help with real freelance work, but not so far inside your records that it bypasses the app built to protect them.
