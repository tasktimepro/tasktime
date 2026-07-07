# Security Policy

TaskTime Pro is local-first software that stores user work data in the browser and exposes same-device agent access only through explicit local pairing.

## Reporting A Vulnerability

Please do not open public issues for vulnerabilities. Use GitHub private vulnerability reporting after the public repository is available, or contact TaskTime Pro through https://tasktime.pro/contact/ before that is configured.

Include:

- Affected version or commit
- Browser, OS, and deployment context
- Reproduction steps
- Whether the issue affects local browser data, Google Drive sync, the local agent bridge, exports, invoice/email workflows, or public docs

## Scope

In scope:

- Local data access or mutation bypasses
- Agent bridge pairing, scope, approval-token, or localhost-origin issues
- Export, invoice, email, sync, and account-data safety issues
- Cross-site scripting or service-worker cache issues in the public app

Out of scope:

- Denial of service against local development servers
- Issues requiring a compromised user device
- Reports for private operational infrastructure that is not part of the public repository, unless the issue is externally reachable from TaskTime Pro users

## Operational Source

The public repository intentionally excludes private Cloudflare Worker source and deployment configuration. Public client and agent-bridge code should not rely on secrets checked into the repo.
