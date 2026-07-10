---
name: post-phase-reconciliation
description: Reconcile project documentation, comments, generated artifacts, and work tracking after a completed slice.
---

# Post-Phase Reconciliation

1. Inventory the completed slice's diff.
2. Cross-reference `spec/`, `contracts/`, `rules/`, `SYSTEM_OVERVIEW.md`, `ARCHITECTURE_MAP.md`, `status/`, public/operational docs, types, validation, comments, and tests.
3. Update stale specifications, contracts, compression docs, documentation, and generated interface artifacts in the same change.
4. Update the relevant status layer only when implementation and required validation are genuinely complete. Mark a `TODO.md` backlog item complete only when it directly represents that finished work; preserve unrelated user notes.
5. Confirm no private infrastructure details or secrets crossed into the public repository.

Keep one authoritative copy of each decision; do not duplicate details across layers when a link and concise summary are sufficient.
