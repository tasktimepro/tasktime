---
name: api-and-interface-design
description: Design or change module, storage, agent, network, and public interfaces contract-first while preserving production compatibility.
---

# API And Interface Design

Use this workflow when a change crosses a boundary between UI and domain logic, Yjs storage, Drive sync, the Worker, agent commands, MCP, packages, or public consumers.

1. Identify producers, consumers, ownership, trust level, transport, persisted shape, and supported historical forms.
2. Read `AGENTS.md`, `rules/domain-invariants.md`, relevant docs, types, validation, tests, and comments.
3. Define required and optional fields, nullability, defaults, validation, errors, compatibility, idempotency, and examples before implementation.
4. Keep external errors sanitized and distinguish authentication, authorization, not-found, validation, conflict, and retry-safe failures where relevant.
5. Add boundary validation and tests for valid data, malformed input, supported legacy input, and important consumers.
6. Update public docs, generated tool catalogs, examples, environment documentation, and behavior comments affected by the interface.

Do not expose raw storage as an API, infer durable shapes from one current producer, or make a clean break in persisted/public contracts without an explicit migration.
