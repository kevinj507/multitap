#!/usr/bin/env bash
# E13.10 memory-safety guard (#436 / 3GB box). The Multitap server sits at ~2GB
# once the ONNX model warms, so a burst of /search|/context can OOM it (signal:
# killed). Use this to (a) verify the endpoint, (b) restart via the gateway mgmt
# API if it's down (NEVER /stop — that 502s the live site), (c) optionally restart
# to FREE the warm model before agent-heavy phases that don't need it.
#   ensure-up.sh check        -> exit 0 if /api/config 200, else restart + wait
#   ensure-up.sh fresh        -> force a restart (drops the 2GB model) + wait healthy
set -uo pipefail
GT_BASE="${MULTITAP_BASE_URL:-${GRAPHTASK_BASE_URL:-http://127.0.0.1:3000}}"
GW="${GATEWAY_MGMT_URL:-http://127.0.0.1:9090}"
MODE="${1:-check}"

is_up() { [ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$GT_BASE/api/config" 2>/dev/null)" = "200" ]; }
restart() {
  curl -sS -X POST "$GW/v1/apps" -H "Authorization: Bearer $GATEWAY_MGMT_TOKEN" -H 'Content-Type: application/json' \
    -d '{"app_id":"multitap","cmd":"bun","args":["run","start"],"cwd":"/data/workspace/multitap","port":3000,"healthcheck_path":"/api/config","desired_state":"running"}' >/dev/null
}
wait_healthy() {
  for i in $(seq 1 30); do if is_up; then return 0; fi; sleep 3; done
  echo "ensure-up: STILL DOWN after restart" >&2; return 1
}

if [ "$MODE" = "fresh" ]; then
  restart; wait_healthy; r=$?
  # warm the search model once so the first real call isn't a cold 2GB spike mid-burst
  echo "ensure-up: restarted fresh (model dropped); $(free -m | awk '/Mem:/{print "free="$4"MB avail="$7"MB"}')" >&2
  exit $r
fi
if is_up; then exit 0; fi
echo "ensure-up: endpoint DOWN -> restarting" >&2
restart; wait_healthy
