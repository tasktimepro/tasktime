# TaskTime Pro Makefile
# Shorthand commands for common Docker operations

APP_RUN_ENV ?=
TOOLS_COMPOSE = docker compose --project-name tasktime-tools
APP_RUN = $(TOOLS_COMPOSE) run --rm $(APP_RUN_ENV) app

.PHONY: help dev dev-core dev-billing-sandbox dev-push-local preview-push-local preview-push-cloud preview-cloud stop build preview preview-build install lint typecheck clean logs shell test test-run test-coverage test-e2e test-e2e-smoke release-gate blog-install blog-dev blog-build

PREVIEW_PORT ?= 3101
PRIVATE_INFRA_MAKEFILE := tasktime-infra/Makefile
TASKTIME_DEV_PROJECT ?= tasktime

DEV_COMPOSE = TASKTIME_DEV_PROJECT=$(TASKTIME_DEV_PROJECT) sh ./scripts/dev-compose.sh

# Default target - show help
help:
	@echo "TaskTime Pro Development Commands"
	@echo "=============================="
	@echo ""
	@echo "  make dev      - Start the complete production-like local stack"
	@echo "  make dev-core - Start only the public core app (diagnostic/public checkout fallback)"
	@echo "  make dev-billing-sandbox - Explicit alias for the complete local stack"
	@echo "  make dev-push-local - Start app dev server with Dropbox UI using local Worker at http://localhost:8787"
	@echo "  make preview-push-local - Build production preview with Dropbox UI using local Worker at http://localhost:8787"
	@echo "  make preview-push-cloud - Build production preview using deployed Worker at https://sync.tasktime.pro"
	@echo "  make preview-cloud - Build production preview using the deployed production Worker"
	@echo "  make stop     - Stop development server"
	@echo "  make build    - Build only the app into dist-app (no site checkout required)"
	@echo "  make preview  - Build and preview the app on PREVIEW_PORT ($(PREVIEW_PORT))"
	@echo "  make preview-build - Build and preview the app; stop make dev first if needed"
	@echo "  make site-dev - Start site in the tasktime group on http://localhost:3102"
	@echo "  make site-build - Build the nested public site independently"
	@echo "  make site-contract - Export the public contract to artifacts/site-contract.json"
	@echo "  make install  - Install all dependencies"
	@echo "  make add PKG=<package>  - Add a new npm package"
	@echo "  make lint     - Run ESLint"
	@echo "  make typecheck - Run the repository-wide TypeScript check"
	@echo "  make logs     - View container logs"
	@echo "  make shell    - Open shell in container"
	@echo "  make clean    - Stop services and rebuild the app image without deleting data"
	@echo "  make test     - Run vitest in watch mode"
	@echo "  make test-run - Run vitest once"
	@echo "  make test-coverage - Run vitest with coverage"
	@echo "  make test-e2e - Run Playwright E2E tests"
	@echo "  make test-e2e-smoke - Run critical Playwright smoke tests in Chromium"
	@echo "  make test-e2e-drive-browsers - Run direct Drive smoke in Chromium, Firefox, and WebKit"
	@echo "  make test-e2e-pwa-smoke - Run production-preview PWA offline boot smoke test"
	@echo "  make release-gate - Run security audit, lint, typecheck, coverage, browser/PWA smoke, and build"
	@echo ""

# The operator checkout defaults to the complete local Worker, Stripe test-mode,
# and app stack. A public checkout without the private infrastructure repository
# keeps the core app usable through the explicit fallback below.
ifneq ("$(wildcard $(PRIVATE_INFRA_MAKEFILE))","")
dev: dev-billing-sandbox
else
dev: dev-local
endif

.PHONY: dev-local
dev-local:
	$(DEV_COMPOSE) up -d --build

# Start only the public core development server. This is intentionally not the
# default when the private production services are available locally.
dev-core:
	docker compose --project-name $(TASKTIME_DEV_PROJECT) up -d --build app
	@echo "Core development server running at http://localhost:3101"
	@echo "Optional public site: make site-dev (http://localhost:3102)"

# Prepare and start the persistent Docker Desktop group, including the optional
# site. Stop preserves containers for Play; preparation is not repeated by Play.
dev-billing-sandbox:
	@test -f $(PRIVATE_INFRA_MAKEFILE) || { echo "Error: tasktime-infra is required for the complete local stack; use make dev-core in a public checkout"; exit 1; }
	$(MAKE) -C tasktime-infra worker-billing-sandbox-prepare
	TASKTIME_DEV_PROJECT=$(TASKTIME_DEV_PROJECT) sh ./scripts/run-billing-sandbox-stack.sh

# Start local app dev server wired to local Wrangler Worker with Dropbox UI.
dev-push-local:
	$(TOOLS_COMPOSE) run --rm -p 3101:3101 \
		-e VITE_SYNC_WORKER_URL=http://localhost:8787 \
		-e VITE_DROPBOX_CLOUD_UI_ENABLED=true \
		-e VITE_PUSH_NOTIFICATIONS_ENABLED=true \
		app sh -lc 'sh ./scripts/start-dev-servers.sh'

# Build and preview production app wired to local Wrangler Worker with Dropbox UI.
# Use this for service-worker/Web Push testing; Vite dev mode unregisters service workers.
preview-push-local:
	$(TOOLS_COMPOSE) run --rm -p 3101:3101 \
		-e VITE_SYNC_WORKER_URL=http://localhost:8787 \
		-e VITE_DROPBOX_CLOUD_UI_ENABLED=true \
		-e VITE_PUSH_NOTIFICATIONS_ENABLED=true \
		app sh -lc 'npm run build && npm run preview -- --host 0.0.0.0 --port 3101'

# Build and preview production app wired to the deployed Cloudflare Worker.
# This verifies the real edge route and browser CORS path before release.
preview-push-cloud:
	$(MAKE) stop
	$(TOOLS_COMPOSE) run --rm -p $(PREVIEW_PORT):$(PREVIEW_PORT) \
		-e VITE_SYNC_WORKER_URL=https://sync.tasktime.pro \
		-e VITE_DROPBOX_CLOUD_UI_ENABLED=true \
		-e VITE_PUSH_NOTIFICATIONS_ENABLED=true \
		app sh -lc 'npm run build && npm run preview -- --host 0.0.0.0 --port $(PREVIEW_PORT)'

# Production-equivalent local browser check. Keep preview-push-cloud as the
# backwards-compatible target used by existing Web Push documentation.
preview-cloud: preview-push-cloud

# Stop development server
stop:
	$(DEV_COMPOSE) stop

# Build for production
build:
	$(APP_RUN) npm run build

# Stop current dev services, build the app, and serve it locally
preview:
	$(MAKE) stop
	$(MAKE) preview-build

# Build the standalone app and serve it locally
preview-build:
	$(TOOLS_COMPOSE) run --rm -p $(PREVIEW_PORT):$(PREVIEW_PORT) app sh -lc 'npm run build && npm run preview -- --host 0.0.0.0 --port $(PREVIEW_PORT)'

# Convenience commands delegate into an independent optional repository.
.PHONY: site-dev site-build site-test site-stop site-contract
site-dev:
	@test -f tasktime-site/docker-compose.yml || { echo "Error: the optional tasktime-site checkout is missing"; exit 1; }
	$(DEV_COMPOSE) up -d --build --no-deps site
site-build:
	$(MAKE) -C tasktime-site build
site-test:
	$(MAKE) -C tasktime-site release-gate
site-stop:
	$(DEV_COMPOSE) stop site
site-contract:
	$(APP_RUN) npm run export:site-contract
	$(APP_RUN) npm run build:site-recovery

# Historical convenience names keep working for existing local instructions.
blog-install:
	$(MAKE) -C tasktime-site install
blog-dev: site-dev
blog-build: site-build

# Install dependencies (useful after pulling changes)
install:
	$(APP_RUN) npm install

# Add a new package (usage: make add PKG=package-name)
add:
	@if [ -z "$(PKG)" ]; then \
		echo "Usage: make add PKG=<package-name>"; \
		exit 1; \
	fi
	$(APP_RUN) npm install $(PKG)
	@echo "Remember to rebuild: make clean"

# Run linter
lint:
	@attempt=1; \
	while [ $$attempt -le 3 ]; do \
		output_file=$$(mktemp); \
		if $(APP_RUN) sh -lc 'find src -maxdepth 4 -type d >/dev/null && npm run lint' >"$$output_file" 2>&1; then \
			cat "$$output_file"; \
			rm -f "$$output_file"; \
			exit 0; \
		fi; \
		cat "$$output_file"; \
		if grep -q "ENOENT: no such file or directory, scandir '/app/src/" "$$output_file" && [ $$attempt -lt 3 ]; then \
			rm -f "$$output_file"; \
			echo "Retrying lint after Docker bind mount settles..."; \
			attempt=$$((attempt + 1)); \
			continue; \
		fi; \
		rm -f "$$output_file"; \
		exit 1; \
	done

# Run tests
typecheck:
	$(APP_RUN) npm run typecheck

test:
	$(APP_RUN) npm test

test-run:
	$(APP_RUN) npm run test:run

test-coverage:
	$(APP_RUN) npm run test:coverage

test-e2e:
	$(APP_RUN) npm run test:e2e

test-e2e-smoke:
	$(APP_RUN) npm run test:e2e:smoke

test-e2e-drive-browsers:
	$(APP_RUN) npm run test:e2e:drive-browsers

test-e2e-pwa-smoke:
	$(APP_RUN) npm run test:e2e:pwa:smoke

# Release gate checks (security audit + lint + typecheck + coverage + browser/PWA smoke + build)
release-gate:
	$(APP_RUN) npm run audit:security
	$(MAKE) lint
	$(APP_RUN) npm run typecheck
	$(APP_RUN) npm run test:build-artifacts
	$(APP_RUN) npm run test:coverage
	$(APP_RUN) npm run test:e2e:smoke
	$(APP_RUN) npm run test:e2e:pwa:smoke
	$(APP_RUN) npm run export:site-contract
	$(APP_RUN) npm run build:site-recovery

# View logs
logs:
	$(DEV_COMPOSE) logs -f

# Open shell in container
shell:
	$(DEV_COMPOSE) exec app sh

# Clean rebuild (stops services and rebuilds the app image; keeps containers/data)
clean:
	$(MAKE) stop
	docker compose build --no-cache
	@echo "Clean rebuild complete. Run 'make dev' to start."

# Run arbitrary npm command (usage: make npm CMD="run test")
npm:
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make npm CMD=\"<npm command>\""; \
		exit 1; \
	fi
	$(APP_RUN) npm $(CMD)
