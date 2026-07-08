# TaskTime Pro Makefile
# Shorthand commands for common Docker operations

APP_RUN_ENV ?=
APP_RUN = docker compose run --rm $(APP_RUN_ENV) app

.PHONY: help dev dev-push-local preview-push-local preview-push-cloud stop build preview preview-build install lint clean logs shell test test-run test-coverage test-e2e test-e2e-smoke test-e2e-pwa-smoke release-gate blog-install blog-dev blog-build

PREVIEW_PORT ?= 3101

# Default target - show help
help:
	@echo "TaskTime Pro Development Commands"
	@echo "=============================="
	@echo ""
	@echo "  make dev      - Start development server (docker compose up)"
	@echo "  make dev-push-local - Start app dev server using local Worker at http://localhost:8787"
	@echo "  make preview-push-local - Build production preview using local Worker at http://localhost:8787"
	@echo "  make preview-push-cloud - Build production preview using deployed Worker at https://sync.tasktime.pro"
	@echo "  make stop     - Stop development server"
	@echo "  make build    - Build for production"
	@echo "  make preview  - Stop current dev containers, build merged app+blog output, and serve it locally on PREVIEW_PORT ($(PREVIEW_PORT))"
	@echo "  make preview-build - Build merged app+blog output and serve it locally on PREVIEW_PORT ($(PREVIEW_PORT)); stop make dev first if needed"
	@echo "  make blog-install - Install blog dependencies"
	@echo "  make blog-dev  - Start Astro blog dev server (http://localhost:4321/blog)"
	@echo "  make blog-build - Build the Astro blog"
	@echo "  make install  - Install all dependencies"
	@echo "  make add PKG=<package>  - Add a new npm package"
	@echo "  make lint     - Run ESLint"
	@echo "  make logs     - View container logs"
	@echo "  make shell    - Open shell in container"
	@echo "  make clean    - Remove containers and rebuild"
	@echo "  make test     - Run vitest in watch mode"
	@echo "  make test-run - Run vitest once"
	@echo "  make test-coverage - Run vitest with coverage"
	@echo "  make test-e2e - Run Playwright E2E tests"
	@echo "  make test-e2e-smoke - Run critical Playwright smoke tests"
	@echo "  make test-e2e-pwa-smoke - Run production-preview PWA offline boot smoke test"
	@echo "  make release-gate - Run coverage, browser smoke, and build"
	@echo ""

# Start development server
dev:
	docker compose up -d
	@echo "Development server running at http://localhost:3101"
	@echo "Blog dev server is available through the same origin at http://localhost:3101/blog"

# Start local app dev server wired to local Wrangler Worker
dev-push-local:
	docker compose run --rm -p 3101:3101 \
		-e VITE_SYNC_WORKER_URL=http://localhost:8787 \
		-e VITE_PUSH_NOTIFICATIONS_ENABLED=true \
		app sh -lc 'sh ./scripts/start-dev-servers.sh'

# Build and preview production app wired to local Wrangler Worker.
# Use this for service-worker/Web Push testing; Vite dev mode unregisters service workers.
preview-push-local:
	docker compose run --rm -p 3101:3101 \
		-e VITE_SYNC_WORKER_URL=http://localhost:8787 \
		-e VITE_PUSH_NOTIFICATIONS_ENABLED=true \
		app sh -lc 'npm run build && npm run preview -- --host 0.0.0.0 --port 3101'

# Build and preview production app wired to the deployed Cloudflare Worker.
# This verifies the real edge route and browser CORS path before release.
preview-push-cloud:
	-docker compose down --remove-orphans
	@leftovers=$$(docker ps -aq --filter "name=tasktime-app-run-"); \
	if [ -n "$$leftovers" ]; then docker rm -f $$leftovers; fi
	docker compose run --rm -p $(PREVIEW_PORT):$(PREVIEW_PORT) \
		-e VITE_SYNC_WORKER_URL=https://sync.tasktime.pro \
		-e VITE_PUSH_NOTIFICATIONS_ENABLED=true \
		app sh -lc 'npm run build && npm run preview -- --host 0.0.0.0 --port $(PREVIEW_PORT)'

# Stop development server
stop:
	docker compose down

# Build for production
build:
	docker compose run --rm app npm run build

# Stop current dev services, build merged app+blog output, and serve it locally
preview:
	-docker compose down --remove-orphans
	@leftovers=$$(docker ps -aq --filter "name=tasktime-app-run-"); \
	if [ -n "$$leftovers" ]; then docker rm -f $$leftovers; fi
	$(MAKE) preview-build

# Build merged app+blog output and serve it locally
preview-build:
	docker compose run --rm -p $(PREVIEW_PORT):$(PREVIEW_PORT) app sh -lc 'npm run build && npm run preview -- --host 0.0.0.0 --port $(PREVIEW_PORT)'

# Install blog dependencies
blog-install:
	docker compose run --rm app sh -lc 'cd blog && npm ci'

# Start Astro blog dev server
blog-dev:
	docker compose run --rm -p 4321:4321 app sh -lc 'cd blog && if [ ! -d node_modules ]; then npm ci; fi && npm run dev -- --host 0.0.0.0 --port 4321'

# Build the Astro blog
blog-build:
	docker compose run --rm app sh -lc 'cd blog && if [ ! -d node_modules ]; then npm ci; fi && npm run build'

# Install dependencies (useful after pulling changes)
install:
	docker compose run --rm app npm install

# Add a new package (usage: make add PKG=package-name)
add:
	@if [ -z "$(PKG)" ]; then \
		echo "Usage: make add PKG=<package-name>"; \
		exit 1; \
	fi
	docker compose run --rm app npm install $(PKG)
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
test:
	docker compose run --rm app npm test

test-run:
	docker compose run --rm app npm run test:run

test-coverage:
	docker compose run --rm app npm run test:coverage

test-e2e:
	docker compose run --rm app npm run test:e2e

test-e2e-smoke:
	docker compose run --rm app npm run test:e2e:smoke

test-e2e-pwa-smoke:
	docker compose run --rm app npm run test:e2e:pwa:smoke

# Release gate checks (coverage + browser smoke + build)
release-gate:
	$(MAKE) lint
	$(APP_RUN) npm run test:coverage
	$(APP_RUN) npm run test:e2e:smoke
	$(APP_RUN) npm run test:e2e:pwa:smoke
	$(APP_RUN) npm run build

# View logs
logs:
	docker compose logs -f

# Open shell in container
shell:
	docker compose exec app sh

# Clean rebuild (removes containers and rebuilds image)
clean:
	docker compose down
	docker compose build --no-cache
	@echo "Clean rebuild complete. Run 'make dev' to start."

# Run arbitrary npm command (usage: make npm CMD="run test")
npm:
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make npm CMD=\"<npm command>\""; \
		exit 1; \
	fi
	docker compose run --rm app npm $(CMD)
