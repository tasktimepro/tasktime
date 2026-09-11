#!/bin/sh
set -eu

# All lifecycle commands resolve the same optional local services. Core tooling
# uses only the base file in a different project, never these private/site inputs.
if [ -f tasktime-site/docker-compose.yml ]; then
    set -- -f docker-compose.site.yml "$@"
fi
if [ -f tasktime-infra/Makefile ]; then
    set -- -f docker-compose.billing-sandbox.yml "$@"
fi

TASKTIME_DEV_UID="${TASKTIME_DEV_UID:-$(id -u)}"
TASKTIME_DEV_GID="${TASKTIME_DEV_GID:-$(id -g)}"
export TASKTIME_DEV_UID TASKTIME_DEV_GID

exec docker compose --project-name "${TASKTIME_DEV_PROJECT:-tasktime}" \
    -f docker-compose.yml "$@"
