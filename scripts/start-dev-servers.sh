#!/bin/sh
set -eu
# Core development has no dependency on the optional nested site checkout.
exec npm run dev -- --host 0.0.0.0 --port 3101
