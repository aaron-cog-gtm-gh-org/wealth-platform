#!/usr/bin/env bash
# Stops the xsp4 server started by pv-up.sh (SQL container is left running; `docker stop pvsql` to stop it).
WORK=${1:-$HOME/pv-run}
if [ -f "$WORK/xsp.pid" ]; then kill "$(cat "$WORK/xsp.pid")" 2>/dev/null || true; rm -f "$WORK/xsp.pid"; fi
pkill -f 'xsp4.exe --port' 2>/dev/null || true
