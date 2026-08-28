# Privacy Policy

Last updated: August 28, 2026

This repository-level policy summarizes how TaskTime Pro handles privacy in the public app, public source repository, packages, and same-device agent bridge. The canonical product policy is published at https://tasktime.pro/privacy/.

TaskTime Pro is built around a simple principle: your work data should remain yours. The app is local-first, avoids account-based data collection, and is designed so project, client, invoice, expense, task, time-entry, and report content does not live in a TaskTime Pro database.

## What TaskTime Pro Stores Locally

TaskTime Pro stores app data in your browser using IndexedDB, Yjs documents, and limited localStorage preferences. This includes data you create in the app, such as:

- projects, clients, tasks, project notes, timers, and time entries
- expenses, tax-return periods, recurrence settings, and reports
- invoices, invoice templates, business information, payment methods, and email templates
- sync preferences, local UI preferences, and local agent bridge pairing state

This data stays on your device unless you choose a feature that intentionally sends or syncs it elsewhere.

## Cloud Sync

Cloud sync is optional. If you connect Google Drive or Dropbox, TaskTime Pro stores sync documents and backups in a TaskTime application folder inside your own selected provider account.

The public app uses a small edge authentication service at `sync.tasktime.pro` to securely maintain the selected provider connection. It stores the session record and encrypted OAuth refresh token needed for that connection, issues short-lived provider access tokens only to an authorized browser connection, and supports revocation. Routine sync file requests travel directly between your browser and Google Drive or Dropbox. The access token stays only in active-browser memory, and the edge service does not receive or retain routine sync file bodies or your work records as a TaskTime-hosted workspace.

Google Drive and Dropbox sync use the minimum practical provider scopes for application-folder storage and account identification. Dropbox storage identity uses a TaskTime-scoped account pseudonym rather than requesting or retaining your Dropbox email address. The selected provider's own terms and privacy policy apply to your account and cloud storage.

You can disconnect cloud sync without deleting the provider files. You can also explicitly wipe validated TaskTime Pro sync files and backups from the selected provider, revoke access, and disconnect the browser.

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

Metrics must not include project names, task names, client names, invoice data, expense data, notes, report contents, email bodies, cloud sync file contents, or raw user records.

## Runtime Diagnostics

TaskTime Pro may use DebugBundle or similar diagnostic tooling for production runtime failures when configured. Diagnostics are for investigating crashes, sync failures, email delivery failures, PDF generation failures, and other operational incidents.

Diagnostics may include error messages, stack traces, environment labels, app service names, source filenames, line numbers, and limited incident metadata. They should not intentionally include user app content. When reporting bugs, avoid pasting private client data, invoice content, tokens, cloud-provider metadata, or other sensitive material into public issues or screenshots.

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
- Dropbox, when you enable sync
- Cloudflare, for public edge services such as OAuth/session control, metrics, notification scheduling, and related app endpoints
- Resend, when you send invoice email
- DebugBundle, when runtime diagnostics are configured
- GitHub and npm, for public source, issue tracking, packages, and release artifacts

These providers process data according to their own policies. TaskTime Pro should use them only for the product function described here, not for advertising or cross-site tracking.

## Cookies And Tracking

TaskTime Pro is designed without advertising cookies, tracking pixels, or cross-site ad tracking. The app uses browser storage for the app itself and for local preferences.

The public website and app should not use third-party analytics to profile users or inspect private work content.

## Retention And Deletion

Local app data remains in your browser until you delete it, clear browser storage, uninstall the app, or replace it through an import or restore flow.

Cloud sync data remains in your Google Drive or Dropbox account until you remove it through TaskTime Pro controls or your provider account. Encrypted OAuth refresh tokens are retained only while the related provider authorization remains active.

Aggregate metrics and operational audit data may be retained for abuse prevention, reliability analysis, and product maintenance. They should be minimized and should not contain private app records.

## User Control

You can:

- use TaskTime Pro without creating an account
- use the app offline without cloud sync
- export your data for backup
- disconnect the selected cloud provider without deleting its files
- wipe cloud sync data and backups through explicit controls
- revoke local agent bridge access
- delete local app data from the Account page

Because TaskTime Pro does not keep a server-side copy of your app records, maintainers generally cannot recover deleted local or provider data for you.

## Security

TaskTime Pro's privacy model depends on your device, browser profile, selected cloud-provider account, and local agent environment being secure. Keep your browser, operating system, and provider account protected.

Report vulnerabilities through [SECURITY.md](./SECURITY.md), not public issues.

## Changes

This policy may change as TaskTime Pro evolves. Material privacy changes should be reflected in both this repository file and the canonical policy at https://tasktime.pro/privacy/.
