# Production Hardening

Hardening is part of each change, especially for storage, sync, billing, imports, agent access, authentication, and external integrations.

## Trust boundaries

- Treat browser input, imported backups, Drive data, Worker responses, MCP requests, environment variables, files, and network messages as untrusted.
- Validate and normalize at the boundary before domain logic or persistence.
- Keep authentication, authorization, ownership, scope, and approval checks close to privileged actions.

## Data and secrets

- Never expose or log tokens, pairing codes, app-session tokens, credentials, private keys, raw sensitive payloads, or private infrastructure details.
- Keep user data local-first and minimize copies in logs, fixtures, screenshots, and diagnostics.
- Make destructive storage, sync, deletion, and billing actions explicit and test-covered.
- Preserve recoverability and compatibility where the product contract requires them.

## Reliability

- Handle partial failure, offline state, retries, idempotency, timeouts, concurrency, cross-tab behavior, and cleanup where relevant.
- Avoid unbounded timers, subscriptions, queues, storage growth, and network work.
- Verify reconnect and replay behavior for changes that can be reintroduced by another device or old backup.

## Release review

Before shipping a relevant change, verify boundary validation, authorization, sanitized errors, secret handling, cleanup, compatibility, negative-path tests, environment documentation, and the appropriate Docker-backed release checks.
