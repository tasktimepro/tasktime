---
name: code-simplification
description: Simplify working code while preserving TaskTime Pro behavior and durable production contracts.
---

# Code Simplification

1. Establish preserved behavior from tests, `AGENTS.md`, relevant rules, docs, comments, and supported persisted shapes.
2. Locate accidental complexity: duplication, hidden side effects, premature abstractions, broad files, circular dependencies, unclear names, or dead compatibility paths.
3. Add characterization tests first when important behavior is under-tested.
4. Make the smallest simplification using direct control flow, clearer names, focused helpers, stable public exports, and removal of genuinely dead code.
5. Preserve comments that explain why; update stale intent and compatibility notes.
6. Run focused tests, then relevant lint, coverage, build, and browser gates through Docker.

Shorter is not automatically simpler. Do not remove compatibility logic until migration and historical-data coverage prove it obsolete.
