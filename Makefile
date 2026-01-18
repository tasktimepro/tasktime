# TaskTime Makefile
# Shorthand commands for common Docker operations

.PHONY: help dev stop build install lint clean logs shell test test-run test-coverage

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
	docker compose run --rm app npm run lint

# Run tests
test:
	docker compose run --rm app npm test

test-run:
	docker compose run --rm app npm run test:run

test-coverage:
	docker compose run --rm app npm run test:coverage

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
