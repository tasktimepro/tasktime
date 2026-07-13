# Agent Bridge

## Behavior

- The local bridge exposes MCP tools derived from the browser command registry.
- Browser pairing establishes a short-lived, single-use trust handoff and then a memory-only app session.
- Every command declares permission scope and may require approval/idempotency behavior according to risk.
- The browser command context owns Yjs mutations and navigation.
- Managed integrations use stable agent identities and status-file discovery without leaking credentials.
- Entity creates reject duplicate IDs before any Yjs mutation, and externally advertised create schemas remain closed to unadvertised caller fields.
- Dashboard/project unbilled summaries and entry queries load complete local task, entry, and invoice history and use the same canonical invoice eligibility, legacy billing evidence, and billable-duration rules as the UI.

## Security and reliability

- Default bind is loopback; origins are restricted.
- Invalid input, missing readiness, permissions, rate limits, unavailable app, and command conflicts return structured sanitized errors.
- Revocation terminates future authority.
- Dynamic ports do not define trust identity.
- Bundle/package/tool-catalog versions and vendored bridge output remain synchronized.

## Evidence

Agent command, protocol, browser endpoint, CSP, approval-token, bridge, CLI, and MCP tests; bundle and live smoke scripts; Playwright agent-bridge flow; generated public docs.
