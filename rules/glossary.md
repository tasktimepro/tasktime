# Canonical Glossary

| Term | Meaning |
|---|---|
| Active timer | A running or paused `MultiTimerState` keyed by project. Different projects may each have one. |
| Agent bridge | The loopback-only local process that exposes MCP tools and relays approved commands to the browser. |
| App session token | Memory-only credential used by a paired browser to reconnect to its local bridge session. |
| Backup mode | Auto-sync mode that automatically pushes local changes but does not automatically pull remote changes except the documented connect/reload behavior. |
| Business command | A validated agent operation that invokes product behavior rather than raw storage access. |
| Core document | Always-loaded Yjs document for projects, active tasks, clients, settings/templates, and other core collections. |
| Drive session | Worker-managed authenticated connection used for optional Google Drive access. |
| Finalized invoice | Invoice whose billing effects have been applied to source work/expenses; distinguish it from a draft or quote. |
| Local-first | The browser's local Yjs/IndexedDB state remains usable without cloud connectivity; cloud sync is optional. |
| Manual mode | Drive mode in which only explicit “Sync Now” performs normal pull/push, except documented pristine-device bootstrap behavior. |
| Pairing code | Short-lived, single-use code that authorizes initial browser-to-bridge pairing. |
| Planner attachment | A dated planner reference to a client, project, task, or expense; it does not duplicate the referenced entity. |
| Project notes | Versioned TipTap JSON content stored with a project plus an optional plain-text preview. |
| Quote | A project pricing document/preview that does not create invoice billing records. |
| Sync mode | Bidirectional Drive mode that pulls and pushes on the documented automatic triggers and cooldowns. |
| TaskTime Pro | Product name. Use this exact capitalization in UI and public documentation. |
| Time entry | Closed interval associated with a task, stored with millisecond timestamps and optional billing snapshots. |
| Work register | `status/` for current execution state; `TODO.md` remains the broader backlog and ideas list. |

Add new domain terms here before using competing names broadly across code, UI, docs, and tests.
