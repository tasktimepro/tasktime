# App Shell And Navigation Design

## Goal

Keep every primary work area reachable while preserving context for running timers, offline state, and current entities.

## Desktop

- Persistent navigation exposes Dashboard, Planner, Clients, Projects, Invoices, Expenses, Reports, and Account.
- The active destination and collapsed/expanded navigation state remain clear.
- Running timers remain globally visible and actionable without returning to a project.

## Mobile

- Bottom navigation prioritizes common destinations; a “more” sheet exposes remaining areas.
- The top bar supplies current context and page actions.
- Safe-area spacing prevents navigation, sheets, timers, and floating actions from colliding with device chrome.

## States and behavior

- Back/forward and deep links update content through `useUrlState`.
- Missing project/client deep links return to their collection rather than rendering stale detail.
- Offline and sync status remain visible without blocking local work.
- Public Astro/static routes must never be swallowed by the SPA shell.
