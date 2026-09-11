#!/bin/sh

set -eu

# Preserve containers after Stop so Docker Desktop can start the whole group.
# No attached lifecycle: exiting a shell or one-off test must not stop services.
exec sh ./scripts/dev-compose.sh up -d --build
