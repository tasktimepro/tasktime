# Docker Standards

All Node and npm commands for this repository run through Docker. Prefer the existing Make targets because they encode the project's service, ports, retries, build composition, and release gates.

## Commands

- Development: `make dev`, `make stop`, `make logs`, `make shell`
- Dependencies: `make install`, `make add PKG=name`
- Validation: `make lint`, `make test-run`, `make test-coverage`, `make test-e2e-smoke`, `make build`
- Broad release validation: `make release-gate`
- Unlisted npm scripts: `make npm CMD="run <script>"`

Do not run npm directly on the host. Do not replace the project Makefile with the generic agent-kit template.

## Safety and configuration

- The app development port is `3101`; the blog development port is `4321`.
- Check Compose, the Makefile, environment examples, and active containers before changing ports.
- Secrets come from untracked environment files or external secret stores, never committed Compose configuration.
- Treat commands that remove volumes, browser data, synced data, or generated release state as destructive. They require explicit user intent and must not be introduced as routine reset steps.
- Keep generated artifacts within the repository workspace or documented Docker volumes.

## Validation

Use the smallest focused Docker-backed check during development, then the relevant broader gate. CI's release gate is authoritative for the public repository.
