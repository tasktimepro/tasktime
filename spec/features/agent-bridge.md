# Agent Bridge

## Behavior

- The local bridge exposes MCP tools derived from the browser command registry.
- Browser pairing establishes a short-lived, single-use trust handoff and then a bounded app session. Its bearer token may exist only in active memory, current-tab `sessionStorage`, and the live bridge session map.
- Successful pairing may register a browser-bound reconnect credential: a non-exportable origin-local P-256 private key in a dedicated credential store and its public-key authorization in bridge memory. A later same-profile tab obtains a fresh app session only after signing a new domain-separated bridge challenge.
- Every command declares permission scope and may require approval/idempotency behavior according to risk.
- The browser command context owns Yjs mutations and navigation.
- Managed integrations use stable agent identities and status-file discovery without leaking credentials.
- The native OpenClaw plugin owns one bridge child for the supervised Gateway/profile lifetime. Ordinary turns reuse it; recognized legacy TaskTime MCP configuration blocks duplicate native startup until explicitly migrated.
- Entity creates reject duplicate IDs before any Yjs mutation, and externally advertised create schemas remain closed to unadvertised caller fields.
- Dashboard/project unbilled summaries and entry queries load complete local task, entry, and invoice history and use the same canonical invoice eligibility, legacy billing evidence, and billable-duration rules as the UI.

## Security and reliability

- Default bind is loopback; origins are restricted.
- Invalid input, missing readiness, permissions, rate limits, unavailable app, and command conflicts return structured sanitized errors.
- Revocation terminates future authority.
- Reconnect challenges are cryptographically random, single-use, expire after at most 30 seconds, and are bound to protocol version, bridge instance, key ID, allowed origin, and expiry. Challenge consumption is atomic and occurs before session issuance.
- Browser reconnect authorization expires no later than the paired authorization, cannot expand scopes, and ends on disconnect/forget, revoke, access disable, definitive proof rejection, key deletion, or bridge/Gateway exit.
- Stable agent IDs, endpoint metadata, key IDs, and status/discovery data are routing/display hints rather than authentication.
- The reconnect private key is generated non-exportable with sign-only usage, never serialized/imported as a supported form, and never enters Yjs, Drive, backup/export, logs, docs, status, diagnostics, or recovery payloads.
- Dynamic ports do not define trust identity.
- Bundle/package/tool-catalog versions and vendored bridge output remain synchronized.

## Evidence

Agent command, protocol, browser endpoint, CSP, approval-token, bridge, CLI, and MCP tests; bundle and live smoke scripts; Playwright agent-bridge flow; generated public docs.
