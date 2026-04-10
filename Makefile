# TaskTime Makefile
# Shorthand commands for common Docker operations

APP_RUN = docker compose run --rm app
WORKER_ENV_FILE ?= .env.worker.local
METRICS_DB_NAME ?= tasktime-metrics

ifneq ("$(wildcard $(WORKER_ENV_FILE))","")
include $(WORKER_ENV_FILE)
export CLOUDFLARE_API_TOKEN
endif

.PHONY: help dev stop build install lint clean logs shell test test-run test-coverage test-e2e test-e2e-smoke test-e2e-pwa-smoke release-gate worker-kv-create worker-kv-create-preview worker-secret worker-deploy worker-logs worker-d1-list worker-d1-create worker-d1-apply worker-metrics-weekly worker-metrics-monthly

# Default target - show help
help:
	@echo "TaskTime Development Commands"
	@echo "=============================="
	@echo ""
	@echo "  make dev      - Start development server (docker compose up)"
	@echo "  make stop     - Stop development server"
	@echo "  make build    - Build for production"
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
	@echo "  make worker-d1-list - List Cloudflare D1 databases"
	@echo "  make worker-d1-create NAME=<db-name> - Create a Cloudflare D1 database"
	@echo "  make worker-d1-apply DB=<db-name> SQL=<file.sql> - Apply SQL to a remote D1 database"
	@echo "  make worker-metrics-weekly - Query weekly active usage totals from D1"
	@echo "  make worker-metrics-monthly - Query monthly active usage totals from D1"
	@echo ""

# Start development server
dev:
	docker compose up -d
	@echo "Development server running at http://localhost:3101"

# Stop development server
stop:
	docker compose down

# Build for production
build:
	docker compose run --rm app npm run build

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
	docker compose run --rm app npm run test:coverage
	docker compose run --rm app npm run test:e2e:smoke
	docker compose run --rm app npm run test:e2e:pwa:smoke
	docker compose run --rm app npm run build

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

# ============================================================================
# Cloudflare Worker Commands
# ============================================================================
# Set CLOUDFLARE_API_TOKEN in your environment or .env.worker.local
# Create token at: https://dash.cloudflare.com/profile/api-tokens
# Required permissions: Account Settings (Read), D1 (Edit), Workers KV Storage (Edit), Workers Scripts (Edit)
# If deploying the custom domain route in cloudflare/wrangler.toml, also add Zone: Workers Routes (Edit)
# and ensure the token can access the zone that hosts sync.tasktime.pro.
# Also ensure the token's Account Resources include the target Cloudflare account.
# Example .env.worker.local contents:
# CLOUDFLARE_API_TOKEN=your-token-here

# Create KV namespaces (run once)
worker-kv-create:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		echo "Create token at: https://dash.cloudflare.com/profile/api-tokens"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler kv:namespace create SESSIONS
	@echo ""
	@echo "Copy the ID above and update cloudflare/wrangler.toml"
	@echo "Then run: make worker-kv-create-preview"

worker-kv-create-preview:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler kv:namespace create SESSIONS --preview
	@echo ""
	@echo "Copy the preview_id above and update cloudflare/wrangler.toml"

# Set a secret (usage: make worker-secret NAME=GOOGLE_CLIENT_ID VALUE=xxx)
worker-secret:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@if [ -z "$(NAME)" ] || [ -z "$(VALUE)" ]; then \
		echo "Usage: make worker-secret NAME=<secret-name> VALUE=<secret-value>"; \
		exit 1; \
	fi
	@cd cloudflare && echo "$(VALUE)" | docker run --rm -i -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler secret put $(NAME)

# Deploy the worker
worker-deploy:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler deploy

# View worker logs
worker-logs:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -it -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler tail

# List D1 databases
worker-d1-list:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler d1 list

# Create a D1 database (usage: make worker-d1-create NAME=tasktime-metrics)
worker-d1-create:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@if [ -z "$(NAME)" ]; then \
		echo "Usage: make worker-d1-create NAME=<database-name>"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler d1 create $(NAME)

# Apply SQL to a remote D1 database (usage: make worker-d1-apply DB=tasktime-metrics SQL=cloudflare/sql/metrics_schema.sql)
worker-d1-apply:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@if [ -z "$(DB)" ] || [ -z "$(SQL)" ]; then \
		echo "Usage: make worker-d1-apply DB=<database-name> SQL=<sql-file>"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler d1 execute $(DB) --remote --file /app/$(patsubst cloudflare/%,%,$(SQL))

# Weekly usage summary from the metrics D1 database
worker-metrics-weekly:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler d1 execute $(METRICS_DB_NAME) --remote --command "SELECT COUNT(DISTINCT device_hash) AS weekly_active_devices, COUNT(DISTINCT dedupe_hash) AS weekly_active_people_approx, COALESCE(SUM(session_count), 0) AS weekly_sessions, COUNT(DISTINCT CASE WHEN is_synced = 1 THEN device_hash END) AS weekly_synced_devices FROM daily_device_usage WHERE day >= date('now', '-6 day') AND meaningful_activity = 1"

# Monthly usage summary from the metrics D1 database
worker-metrics-monthly:
	@if [ -z "$(CLOUDFLARE_API_TOKEN)" ]; then \
		echo "Error: CLOUDFLARE_API_TOKEN not set"; \
		exit 1; \
	fi
	@cd cloudflare && docker run --rm -v "$$(pwd):/app" -w /app \
		-e CLOUDFLARE_API_TOKEN \
		node:20-alpine npx wrangler d1 execute $(METRICS_DB_NAME) --remote --command "SELECT COUNT(DISTINCT device_hash) AS monthly_active_devices, COUNT(DISTINCT dedupe_hash) AS monthly_active_people_approx, COALESCE(SUM(session_count), 0) AS monthly_sessions, COUNT(DISTINCT CASE WHEN is_synced = 1 THEN device_hash END) AS monthly_synced_devices FROM daily_device_usage WHERE day >= date('now', '-29 day') AND meaningful_activity = 1"
