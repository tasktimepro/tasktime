#!/bin/sh

set -u

interrupted=0

cleanup() {
    TASKTIME_DEV_UID="$(id -u)" TASKTIME_DEV_GID="$(id -g)" \
        docker compose -f docker-compose.yml -f docker-compose.billing-sandbox.yml down --remove-orphans
}

trap cleanup 0
trap 'interrupted=1' INT TERM

status=0
TASKTIME_DEV_UID="$(id -u)" TASKTIME_DEV_GID="$(id -g)" \
    docker compose -f docker-compose.yml -f docker-compose.billing-sandbox.yml up --abort-on-container-exit --remove-orphans \
    || status=$?

if [ "$interrupted" -eq 1 ] || [ "$status" -eq 130 ] || [ "$status" -eq 143 ]; then
    exit 0
fi

exit "$status"
