# Privacy Policy

Last updated: July 8, 2026

This repository-level policy summarizes how TaskTime Pro handles privacy in the public app, public source repository, packages, and same-device agent bridge. The canonical product policy is published at https://tasktime.pro/privacy/.

TaskTime Pro is built around a simple principle: your work data should remain yours. The app is local-first, avoids account-based data collection, and is designed so project, client, invoice, expense, task, time-entry, and report content does not live in a TaskTime Pro database.

## What TaskTime Pro Stores Locally

TaskTime Pro stores app data in your browser using IndexedDB, Yjs documents, and limited localStorage preferences. This includes data you create in the app, such as:

- projects, clients, tasks, project notes, timers, and time entries
- expenses, tax-return periods, recurrence settings, and reports
- invoices, invoice templates, business information, payment methods, and email templates
- sync preferences, local UI preferences, and local agent bridge pairing state

This data stays on your device unless you choose a feature that intentionally sends or syncs it elsewhere.

## Google Drive Sync

Google Drive sync is optional. If you connect it, TaskTime Pro stores sync documents and backups in the app-data area of your own Google Drive account.

The public app uses a small edge authentication service at `sync.tasktime.pro` to complete Google OAuth, proxy Drive API calls, and keep the Drive session alive. That service stores a session identifier and encrypted OAuth refresh token. It is not designed to inspect your project, invoice, task, expense, or time-entry content.

Google Drive sync uses the minimum practical Google scopes for app-data sync and account identification. Google's own terms and privacy policy apply to your Google account and Drive storage.

You can disconnect Drive sync from the app. You can also wipe TaskTime Pro sync data and backups from Drive through explicit app controls.

## Agent Bridge

The TaskTime Pro agent bridge is same-device only. The bridge does not read browser IndexedDB or Yjs files directly. It starts a loopback MCP server, waits for the visible browser app to pair, and forwards approved commands to that app session.

Agent access requires explicit local pairing and scoped permissions. Revoking access in TaskTime Pro stops the paired bridge from using the app. Agent tools should not be used to bypass app validation, mutate raw storage, or extract sensitive data outside the user's intent.

## Invoice Email Sending

If you use the Send Invoice feature, your browser generates the invoice PDF and sends the email content and recipient information to Resend for delivery. Resend is a third-party email delivery provider, and its privacy policy applies to that delivery step.

TaskTime Pro stores only minimal server-side audit data for this feature, such as hashed identifiers and timestamps used to enforce monthly send limits and reduce duplicate sends. Invoice content, PDF data, and email bodies are not kept as a TaskTime Pro server-side archive.

## Notifications And Reminders

If you enable system reminders, TaskTime Pro stores only the browser push subscription and generic reminder scheduling data needed to deliver reminders. Reminder infrastructure should not store task names, project names, client names, invoice details, expense amounts, notes, or other app content.

Turning reminders off removes the device subscription and cancels future scheduled reminders.

## Usage Metrics

TaskTime Pro sends limited aggregate usage counters from the production app origin when metrics are enabled. These counters are intended to answer questions like whether sessions occurred and which broad action categories were used.

Metrics may include:

- app version
- a generated device install identifier
- local day buckets
- session counts
- aggregate counts for broad actions such as task creation, timer use, preference updates, or import/export activity
- whether sync was enabled for a bucket

Metrics must not include project names, task names, client names, invoice data, expense data, notes, report contents, email bodies, Drive file contents, or raw user records.

## Runtime Diagnostics

TaskTime Pro may use DebugBundle or similar diagnostic tooling for production runtime failures when configured. Diagnostics are for investigating crashes, sync failures, email delivery failures, PDF generation failures, and other operational incidents.

Diagnostics may include error messages, stack traces, environment labels, app service names, source filenames, line numbers, and limited incident metadata. They should not intentionally include user app content. When reporting bugs, avoid pasting private client data, invoice content, tokens, Drive metadata, or other sensitive material into public issues or screenshots.

## Public Repository And Contributions

This repository is public. Anything posted in public issues, pull requests, discussions, commits, or comments can be visible to the public and may be retained by GitHub.

Do not post:

- real client, invoice, expense, project, or time-entry data
- OAuth tokens, session IDs, API keys, secrets, provider account IDs, or production infrastructure identifiers
- private Worker code, deployment configuration, internal runbooks, or non-public operational logs

Use synthetic examples for public reports. Follow [SECURITY.md](./SECURITY.md) for vulnerabilities.

## Third Parties

TaskTime Pro may interact with:

- Google Drive, when you enable sync
- Cloudflare, for public edge services such as OAuth/session proxying, metrics, notification scheduling, and related app endpoints
- Resend, when you send invoice email
- DebugBundle, when runtime diagnostics are configured
- GitHub and npm, for public source, issue tracking, packages, and release artifacts

These providers process data according to their own policies. TaskTime Pro should use them only for the product function described here, not for advertising or cross-site tracking.

## Cookies And Tracking

TaskTime Pro is designed without advertising cookies, tracking pixels, or cross-site ad tracking. The app uses browser storage for the app itself and for local preferences.

The public website and app should not use third-party analytics to profile users or inspect private work content.

## Retention And Deletion

Local app data remains in your browser until you delete it, clear browser storage, uninstall the app, or replace it through an import or restore flow.

Google Drive sync data remains in your Drive until you remove it through TaskTime Pro controls or your Google account. Encrypted OAuth refresh tokens are retained only while the Drive session remains connected.

Aggregate metrics and operational audit data may be retained for abuse prevention, reliability analysis, and product maintenance. They should be minimized and should not contain private app records.

## User Control

You can:

- use TaskTime Pro without creating an account
- use the app offline without Google Drive sync
- export your data for backup
- disconnect Google Drive sync
- wipe Drive sync data and backups through explicit controls
- revoke local agent bridge access
- delete local app data from the Account page

Because TaskTime Pro does not keep a server-side copy of your app records, maintainers generally cannot recover deleted local or Drive data for you.

## Security

TaskTime Pro's privacy model depends on your device, browser profile, Google account, and local agent environment being secure. Keep your browser, operating system, and Google account protected.

Report vulnerabilities through [SECURITY.md](./SECURITY.md), not public issues.

## Changes

This policy may change as TaskTime Pro evolves. Material privacy changes should be reflected in both this repository file and the canonical policy at https://tasktime.pro/privacy/.
