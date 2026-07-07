# Security Policy

TaskTime Pro is local-first software for work data, invoicing, expenses, sync, and same-device AI agent access. Security reports are taken seriously because the app handles private business data.

## Supported Scope

Security reports should target the current public `main` branch, the production app at https://tasktime.pro, or the published TaskTime Pro agent bridge packages.

In scope:

- Local data access or mutation bypasses
- Yjs, IndexedDB, export/import, backup, or Drive sync data-safety issues
- Agent bridge pairing, scope, approval-token, localhost-origin, or revocation issues
- Invoice, email, expense, report, and account-data safety issues
- Cross-site scripting, service-worker cache, or public-site security issues

Out of scope:

- Denial of service against local development servers
- Issues requiring full compromise of the user's device or browser profile
- Vulnerability scanner noise without a practical TaskTime Pro impact
- Private operational infrastructure that is not present in this public repository, unless the issue is externally reachable by TaskTime Pro users

## Reporting A Vulnerability

Please do not open public issues for vulnerabilities.

Use GitHub private vulnerability reporting for `tasktimepro/tasktime` when available. If that is not available, contact TaskTime Pro through https://tasktime.pro/contact/.

Include:

- Affected version, commit, package, or URL
- Browser, OS, and relevant deployment context
- Reproduction steps or a minimal proof of concept
- Expected impact and affected data or workflow
- Whether the issue involves local browser data, Drive sync, the agent bridge, exports, invoices, email, or public docs

## Disclosure

Please give maintainers time to investigate and prepare a fix before public disclosure. We do not run a paid bug bounty program at this time.

## Public Repository Boundary

This public repository intentionally excludes private Cloudflare Worker source, deployment workflows, secrets, provider account IDs, production KV/D1 identifiers, and internal operational runbooks.

Public client and agent bridge code should not rely on secrets checked into the repository.
