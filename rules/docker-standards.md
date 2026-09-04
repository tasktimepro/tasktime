# Docker Standards

All Node and npm commands for this repository run through Docker. Prefer the existing Make targets because they encode the project's service, ports, retries, build composition, and release gates.

## Commands

- Development: `make dev`, `make stop`, `make logs`, `make shell`; use
  `make dev-core` only for an isolated public-core diagnostic
- Dependencies: `make install`, `make add PKG=name`
- Validation: `make lint`, `make test-run`, `make test-coverage`, `make test-e2e-smoke`, `make build`
- Broad release validation: `make release-gate`
- Unlisted npm scripts: `make npm CMD="run <script>"`

Do not run npm directly on the host. Do not replace the project Makefile with the generic agent-kit template.

## Safety and configuration

- The app development port is `3101`; the blog development port is `4321`.
- In an operator checkout, `make dev` owns the complete app, local Worker/D1,
  Stripe test listener, and hosted-service stack. Production-enabled Worker
  controls must remain enabled locally; test-mode billing may additionally be
  enabled behind its loopback/development guard. A public checkout without the
  private infrastructure repository falls back to the core app.
- Keep the long-running operator stack in its dedicated Compose project so
  one-off `make npm`, test, lint, typecheck, and build containers cannot become
  part of its attached lifecycle or trigger its shared shutdown behavior.
- Check Compose, the Makefile, environment examples, and active containers before changing ports.
- Secrets come from untracked environment files or external secret stores, never committed Compose configuration.
- Treat commands that remove volumes, browser data, synced data, or generated release state as destructive. They require explicit user intent and must not be introduced as routine reset steps.
- Keep generated artifacts within the repository workspace or documented Docker volumes.

## Validation

Use the smallest focused Docker-backed check during development, then the relevant broader gate. CI's release gate is authoritative for the public repository.
