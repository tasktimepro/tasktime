#!/bin/sh

set -eu

astro_pid=""

cleanup() {
    if [ -n "$astro_pid" ]; then
        kill "$astro_pid" 2>/dev/null || true
        wait "$astro_pid" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

if [ ! -d blog/node_modules ]; then
    echo "Installing blog dependencies..."
    cd blog
    npm ci
    cd /app
fi

cd blog
npm run dev -- --host 0.0.0.0 --port 4321 &
astro_pid=$!
cd /app

npm run dev -- --host 0.0.0.0 --port 3101