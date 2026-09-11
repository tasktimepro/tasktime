# Privacy Policy

Last updated: September 11, 2026

This repository-level policy summarizes how TaskTime Pro handles privacy in the public app, public source repository, packages, and same-device agent bridge. The canonical product policy is published at https://tasktime.pro/privacy/.

TaskTime Pro is built around a simple principle: your work data should remain yours. The app is local-first, requires no account for core use, and is designed so project, client, invoice, expense, task, time-entry, and report content does not live in a TaskTime Pro database. Optional connected services and Pro billing use the limited records described below.

## What TaskTime Pro Stores Locally

TaskTime Pro stores app data in your browser using IndexedDB, Yjs documents, and limited localStorage preferences. This includes data you create in the app, such as:

- projects, clients, tasks, project notes, timers, and time entries
- expenses, tax-return periods, recurrence settings, and reports
- invoices, invoice templates, business information, payment methods, and email templates
- sync preferences, local UI preferences, and local agent bridge pairing state
- the connected cloud account email used to identify the selected provider in the interface

This data stays on your device unless you choose a feature that intentionally sends or syncs it elsewhere.

## Cloud Sync

Cloud sync is optional. If you connect Google Drive or Dropbox, TaskTime Pro stores sync documents and backups in a TaskTime application folder inside your own selected provider account.

The public app uses a small edge authentication service at `sync.tasktime.pro` to securely maintain the selected provider connection. It stores the session record and encrypted OAuth refresh token needed for that connection, issues short-lived provider access tokens only to an authorized browser connection, and supports revocation. Routine sync file requests travel directly between your browser and Google Drive or Dropbox. The access token stays only in active-browser memory, and the edge service does not receive or retain routine sync file bodies or your work records as a TaskTime-hosted workspace.

Google Drive and Dropbox sync use the minimum practical provider scopes for application-folder storage and account identification. Dropbox grants include account-information read access so your browser can retrieve the verified account email directly from Dropbox and show which account is connected. That email stays in the local browser authentication record unless you choose to share it for billing at checkout; it is excluded from work-data sync, backups, exports, and aggregate metrics. The edge service identifies Dropbox storage through a TaskTime-scoped account pseudonym rather than retaining the Dropbox profile response. The selected provider's own terms and privacy policy apply to your account and cloud storage.

You can disconnect cloud sync without deleting the provider files. You can also explicitly wipe validated TaskTime Pro sync files and backups from the selected provider, revoke access, and disconnect the browser.

## Agent Bridge

The TaskTime Pro agent bridge is same-device only. The bridge does not read browser IndexedDB or Yjs files directly. It starts a loopback MCP server, waits for the visible browser app to pair, and forwards approved commands to that app session.

Agent access requires explicit local pairing and scoped permissions. Revoking access in TaskTime Pro stops the paired bridge from using the app. Agent tools should not be used to bypass app validation, mutate raw storage, or extract sensitive data outside the user's intent.

## Optional Pro Billing

Optional Pro uses a billing profile linked to your connected Google Drive or Dropbox identity, with plan, trial, and usage records. [Stripe](https://stripe.com/privacy) processes payments and the contact and tax details supplied at checkout. TaskTime Pro does not store full card details. Billing records are separate from your workspace and are not included in work-data sync or backups.

## Invoice Email Sending

If you use optional Pro hosted sending, your browser generates the invoice or quote PDF and sends it with the email content and recipient information through TaskTime Pro's edge service to Resend for delivery. Resend is a third-party email delivery provider, and its privacy policy applies to that delivery step. PDF downloads and manual delivery remain Free.

TaskTime Pro keeps minimal delivery and usage records, such as account references, hashed recipient identifiers, status, and timestamps, to enforce send limits and reduce duplicate sends. Invoice content, PDF data, and email bodies are not kept as a TaskTime Pro server-side archive.

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
- Stripe, when you purchase or manage optional Pro
- Resend, when you use hosted email sending
- DebugBundle, when runtime diagnostics are configured
- GitHub and npm, for public source, issue tracking, packages, and release artifacts

These providers process data according to their own policies. TaskTime Pro should use them only for the product function described here, not for advertising or cross-site tracking.

## Cookies And Tracking

TaskTime Pro is designed without advertising cookies, tracking pixels, or cross-site ad tracking. The app uses browser storage for the app itself and for local preferences.

The public website and app should not use third-party analytics to profile users or inspect private work content. Stripe's checkout and billing pages use storage and cookies under Stripe's own policy.

## Retention And Deletion

Local app data remains in your browser until you delete it, clear browser storage, uninstall the app, or replace it through an import or restore flow.

Cloud sync data remains in your Google Drive or Dropbox account until you remove it through TaskTime Pro controls or your provider account. Encrypted OAuth refresh tokens are retained only while the related provider authorization remains active.

Aggregate metrics and operational audit data may be retained for abuse prevention, reliability analysis, and product maintenance. They should be minimized and should not contain private app records.

Billing records are retained as needed to manage subscriptions, prevent abuse, and meet accounting obligations. Contact support@tasktime.pro about billing-record access or deletion. Deleting local workspace data does not cancel a subscription; manage Pro separately in the app's billing settings.

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
