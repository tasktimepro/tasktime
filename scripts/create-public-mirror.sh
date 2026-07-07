#!/usr/bin/env bash
set -euo pipefail

SOURCE_REPO="$(git rev-parse --show-toplevel)"
DESTINATION="${1:-}"

if [ -z "$DESTINATION" ]; then
    echo "Usage: scripts/create-public-mirror.sh <destination-directory>" >&2
    exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Commit or stash local changes before creating the public mirror." >&2
    exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1; then
    echo "git-filter-repo is required. Install it first, for example: brew install git-filter-repo" >&2
    exit 1
fi

if [ -e "$DESTINATION" ]; then
    echo "Destination already exists: $DESTINATION" >&2
    exit 1
fi

git clone --no-local "$SOURCE_REPO" "$DESTINATION"

cd "$DESTINATION"

git filter-repo --force \
    --path cloudflare/ \
    --path docs/ \
    --path .github/ \
    --path tasktime-infra/ \
    --invert-paths

cat <<'MESSAGE'

Public mirror created.

Next:
  cd into the mirror and run:
    rg -n -i "tasktime-infra|cloudflare|wrangler|secret|token|account_id|kv_namespace|d1_database|sync\\.tasktime\\.pro|owenfar"
    make npm CMD="run test:run -- src/agent/bridge/cli.test.ts"
    make npm CMD="--prefix blog run build"
    make npm CMD="run smoke:agent-bridge"
    make lint
    make build

Review every remaining operational reference before pushing to tasktimepro/tasktime.
MESSAGE
