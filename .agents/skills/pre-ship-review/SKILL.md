---
name: pre-ship-review
description: Audit what can still break before a TaskTime Pro work item or release slice is marked complete.
---

# Pre-Ship Review

For each changed module, route, persisted shape, command, and data path, check:

1. Bad input, empty state, concurrency, retry, offline, reconnect, partial failure, and historical data.
2. Authentication, authorization, ownership, scope, approval, secret handling, and public/private boundaries.
3. Resource cleanup for timers, subscriptions, connections, handles, files, and temporary state.
4. Agreement among UI, domain logic, Yjs storage, sync, imports/exports, invoices, reports, and agent commands.
5. Migration and backward compatibility for existing local and Drive-backed users.
6. Test coverage that would catch removal or regression of the behavior.
7. Accurate comments, docs, generated artifacts, and Docker-backed validation.

Report and resolve material issues before declaring the slice ready.
