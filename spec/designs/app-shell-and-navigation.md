# App Shell And Navigation Design

## Goal

Keep every primary work area reachable while preserving context for running timers, offline state, and current entities.

## Desktop

- Persistent navigation exposes Dashboard, Planner, Clients, Projects, Invoices, Expenses, Reports, and Account.
- The active destination and collapsed/expanded navigation state remain clear.
- During sidebar width transitions, the logo and collapse action keep their size;
  TaskTime Pro stays on one line with ellipsis until the full title fits.
- Three-dot action menus behave as non-modal overlays: the page remains
  scrollable while they are open. Up to 8px of incidental movement leaves the
  menu open; moving its trigger beyond that threshold dismisses it.
- Running timers remain globally visible and actionable without returning to a project.

## Mobile

- Bottom navigation prioritizes common destinations; a “more” sheet exposes remaining areas.
- The top bar supplies current context and page actions.
- Safe-area spacing prevents navigation, sheets, timers, and floating actions from colliding with device chrome.

## States and behavior

- Back/forward and deep links update content through `useUrlState`.
- Missing project/client deep links return to their collection rather than rendering stale detail.
- Offline and sync status remain visible without blocking local work.
- The visible sync-status control remains actionable during loading and active sync states, opening Account > Cloud Sync for progress and recovery details without starting another sync.
- Public Astro/static routes must never be swallowed by the SPA shell.


## Account entry

The Account header always provides the account action in the same position:
Sign in for a fresh signed-out user, Sign out when connected, and Reconnect for
a retained provider connection. Sign in opens a compact provider-choice modal
using the existing Google Drive/Dropbox authentication hooks and availability
controls. It stays on the selected Account tab, disables duplicate/offline
attempts, shows progress/errors, and closes when the cloud connection is ready.
Closing restores focus to the header action, including after viewport changes.
A retained provider reconnects through that provider; switching and moved-source
recovery remain governed by the existing Cloud Sync transfer/recovery workflow.
Temporarily unavailable retained Dropbox sessions use the existing status retry
instead of starting a replacement OAuth session. Retry results reach all mounted
auth consumers so the sync runtime can recover too. Storage connection failures
remain visible in the modal with a link to connection details.
This entry point does not change sync modes, OAuth scopes, hosted identity,
sign-out deletion semantics, or local-data preservation.
