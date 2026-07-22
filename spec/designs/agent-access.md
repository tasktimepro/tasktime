# Agent Access Experience Design

## Goal

Make same-device agent access easy to establish while keeping trust, scope, approval, and revocation visible.

- Account agent settings explain that the browser remains data owner and the bridge is local-only.
- Setup begins with bridge discovery/status before asking the user to launch anything manually.
- Pairing codes are clearly temporary and refreshable.
- Connected agents display stable identity/label, granted capabilities, and revocation controls.
- Sensitive commands surface approval requirements; failures distinguish expired pairing, missing scope, revoked access, rate limit, and unavailable app state.
- The normal managed path reconnects across refresh and same-profile close/reopen without repeatedly asking for trust: refresh uses current-tab session state, while reopen uses a browser-bound proof-of-possession key to obtain a fresh app session.
- The UI distinguishes `Reconnecting`, bridge unavailable, remembered-browser authorization expired, and explicit re-pair states.
- Disconnect/forget removes this browser profile's reconnect authorization; revoke remains the broader authority-ending action documented by the bridge.
- Another browser profile, device, private session, expired authorization, or restarted OpenClaw Gateway requires explicit pairing.

No screen or documentation may display an app-session token, reconnect private key/signature, or imply selectable scopes that the current UI does not expose. Trusted chat approval grants and browser connection continuity remain visibly separate concepts.
