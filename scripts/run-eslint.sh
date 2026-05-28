#!/bin/sh

set -eu

warm_bind_mount() {
    find src -maxdepth 4 -type d >/dev/null 2>&1 || true
}

warm_bind_mount

if output=$(eslint . 2>&1); then
    printf '%s\n' "$output"
    exit 0
else
    status=$?
fi

case "$output" in
    *"ENOENT: no such file or directory, scandir '/app/src/"*)
        warm_bind_mount
        exec eslint .
        ;;
esac

printf '%s\n' "$output" >&2
exit "$status"
