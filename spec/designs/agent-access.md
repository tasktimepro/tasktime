# Agent Access Experience Design

## Goal

Make same-device agent access easy to establish while keeping trust, scope, approval, and revocation visible.

- Account agent settings explain that the browser remains data owner and the bridge is local-only.
- Setup begins with bridge discovery/status before asking the user to launch anything manually.
- Pairing codes are clearly temporary and refreshable.
- Connected agents display stable identity/label, granted capabilities, and revocation controls.
- Sensitive commands surface approval requirements; failures distinguish expired pairing, missing scope, revoked access, rate limit, and unavailable app state.
- The normal managed path reconnects with memory-only session state rather than repeatedly asking for trust.

No screen or documentation may display an app-session token or imply selectable scopes that the current UI does not expose.
