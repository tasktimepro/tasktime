---
name: security-and-hardening
description: Apply security, privacy, reliability, and production-hardening checks to TaskTime Pro boundaries and releases.
---

# Security And Hardening

Use for auth, agent pairing, input, import/export, storage, sync, external services, secrets, deployment-facing artifacts, and release gates.

1. Map every trust boundary and read `rules/production-hardening.md`, `rules/domain-invariants.md`, relevant docs, validation, and tests.
2. Validate and normalize untrusted input before domain logic or persistence.
3. Verify identity, ownership, scopes, approval tokens, and revocation at privileged actions.
4. Check that tokens, pairing codes, app-session tokens, user data, credentials, and private infrastructure details cannot leak through logs, errors, files, fixtures, screenshots, or docs.
5. Consider timeouts, retries, idempotency, replay, offline/reconnect behavior, rate/abuse controls, and cleanup.
6. Add negative-path tests and run risk-appropriate Docker-backed gates.

UI visibility is not authorization. Never use data reset as a substitute for safe compatibility or recovery.
